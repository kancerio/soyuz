jest.mock('@nestjs/axios', () => {
  class HttpService {}
  class HttpModule {}
  return { HttpService, HttpModule };
});

jest.mock('@nestjs/event-emitter', () => {
  class EventEmitter2 {
    emit() {}
  }
  return {
    EventEmitter2,
    OnEvent: () => () => {},
  };
});
