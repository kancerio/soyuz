import 'reflect-metadata';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Chat } from '../chats/chat.entity';
import { ChatParticipant } from '../chats/chat-participant.entity';
import { Message } from '../messages/message.entity';

const enabled = process.env.DB_INTEGRATION_TESTS === 'true';
const databaseName = process.env.DB_DATABASE ?? '';

if (enabled && !databaseName.endsWith('_test')) {
  throw new Error('PostgreSQL integration tests require DB_DATABASE to end with _test');
}

(enabled ? describe : describe.skip)('PostgreSQL schema integration', () => {
  let dataSource: DataSource;
  let users: Repository<User>;
  let chats: Repository<Chat>;
  let messages: Repository<Message>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'messenger',
      password: process.env.DB_PASSWORD ?? 'secretpassword',
      database: databaseName,
      entities: [User, Chat, ChatParticipant, Message],
      synchronize: true,
      dropSchema: true,
    });

    await dataSource.initialize();
    users = dataSource.getRepository(User);
    chats = dataSource.getRepository(Chat);
    messages = dataSource.getRepository(Message);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('creates users and persists defaults and timestamps', async () => {
    const user = await users.save(users.create({
      email: 'denis@example.test',
      username: 'denis',
      password: 'hashed-password',
    }));

    const stored = await users.findOneByOrFail({ id: user.id });
    expect(stored.email).toBe('denis@example.test');
    expect(stored.preferred_language).toBe('en');
    expect(stored.createdAt).toBeInstanceOf(Date);
  });

  it('enforces unique user email and username in PostgreSQL', async () => {
    await users.save(users.create({ email: 'one@example.test', username: 'one', password: 'hash' }));

    await expect(users.save(users.create({ email: 'one@example.test', username: 'two', password: 'hash' })))
      .rejects.toBeInstanceOf(QueryFailedError);
    await expect(users.save(users.create({ email: 'two@example.test', username: 'one', password: 'hash' })))
      .rejects.toBeInstanceOf(QueryFailedError);
  });

  it('persists chat messages and supports read, update, and soft delete fields', async () => {
    const user = await users.save(users.create({ email: 'chat@example.test', username: 'chat-user', password: 'hash' }));
    const chat = await chats.save(chats.create({ title: 'DB test', isGroup: true }));
    const message = await messages.save(messages.create({ content: 'hello', userId: user.id, chatId: chat.id }));

    expect(await messages.findBy({ chatId: chat.id })).toHaveLength(1);
    await messages.update(message.id, { content: 'edited', isEdited: true });
    await messages.update(message.id, { content: '[Сообщение удалено]', isDeleted: true });

    await expect(messages.findOneByOrFail({ id: message.id })).resolves.toMatchObject({
      content: '[Сообщение удалено]',
      isEdited: true,
      isDeleted: true,
      userId: user.id,
      chatId: chat.id,
    });
  });

  it('rejects records that violate required database columns', async () => {
    await expect(users.save(users.create({ email: null as unknown as string, username: 'invalid', password: 'hash' })))
      .rejects.toBeInstanceOf(QueryFailedError);
  });
});
