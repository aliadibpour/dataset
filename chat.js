import { EntitySchema } from "typeorm";

const chatEntity = new EntitySchema({
  name: "Chat",
  tableName: "chats",
  columns: {
    id: {
      type: String,
      primary: true,
    },
    title: {
      type: String,
    },
  },
});

export default chatEntity;