export interface GroupMember {
  userId: number;
  username: string;
  role: 'owner' | 'admin' | 'member';
}

export interface GroupChat {
  id: number;
  title: string;
  members: GroupMember[];
}

export interface GroupMessage {
  id: number;
  text: string;
  senderId: number;
  chatId: number;
  timestamp: Date;
}

let groups: GroupChat[] = [];
let groupMessages: Record<number, GroupMessage[]> = {};

if (typeof window !== 'undefined') {
  const storedGroups = localStorage.getItem('mockGroups');
  if (storedGroups) groups = JSON.parse(storedGroups);
  const storedMessages = localStorage.getItem('mockGroupMessages');
  if (storedMessages) groupMessages = JSON.parse(storedMessages);
}

function saveGroups() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('mockGroups', JSON.stringify(groups));
  }
}

function saveMessages() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('mockGroupMessages', JSON.stringify(groupMessages));
  }
}

export const mockGroupStore = {
  getGroups: () => groups,
  getGroup: (chatId: number) => groups.find(g => g.id === chatId),

  createGroup: (title: string, creatorId: number, participantIds: number[], allUsers: any[]) => {
    const newId = Date.now();
    const members: GroupMember[] = [
      { userId: creatorId, username: allUsers.find(u => u.id === creatorId)?.username || 'Owner', role: 'owner' },
      ...participantIds.map(uid => ({
        userId: uid,
        username: allUsers.find(u => u.id === uid)?.username || `User${uid}`,
        role: 'member' as const
      }))
    ];
    const newGroup: GroupChat = { id: newId, title, members };
    groups.push(newGroup);
    saveGroups();
    return newGroup;
  },

  updateMemberRole: (chatId: number, userId: number, newRole: 'admin' | 'member') => {
    const group = groups.find(g => g.id === chatId);
    if (!group) return false;
    const member = group.members.find(m => m.userId === userId);
    if (member && member.role !== 'owner') {
      member.role = newRole;
      saveGroups();
      return true;
    }
    return false;
  },

  getMembers: (chatId: number) => groups.find(g => g.id === chatId)?.members || [],

  removeMember: (chatId: number, userId: number) => {
    const groupIndex = groups.findIndex(g => g.id === chatId);
    if (groupIndex === -1) return false;
    const group = groups[groupIndex];
    const memberIndex = group.members.findIndex(m => m.userId === userId);
    if (memberIndex !== -1) {
      group.members.splice(memberIndex, 1);
      if (group.members.length === 0) {
        groups.splice(groupIndex, 1);
        delete groupMessages[chatId];
      }
      saveGroups();
      saveMessages();
      return true;
    }
    return false;
  },

  // Работа с сообщениями групп
  getMessages: (chatId: number) => groupMessages[chatId] || [],
  addMessage: (chatId: number, message: GroupMessage) => {
    if (!groupMessages[chatId]) groupMessages[chatId] = [];
    groupMessages[chatId].push(message);
    saveMessages();
    return message;
  },
};