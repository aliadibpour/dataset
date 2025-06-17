import { EntitySchema } from "typeorm";

const chatEntity = new EntitySchema({
  name: "Chat",
  tableName: "chats",
  columns: {
    messageId: {
      type: String,
      primary: true,
    },
    chatId: {
      type: String,
      nullable: false,
    },
  },
});

export default chatEntity;