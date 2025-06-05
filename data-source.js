import { DataSource } from "typeorm";
import ChatEntity from "./chat.js"

const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "postgres",
  password: "Aliadibpc0",
  database: "dataset",
  synchronize: true,
  logging: false,
  entities: [ChatEntity], // Use the schema, not class
});

export default AppDataSource;