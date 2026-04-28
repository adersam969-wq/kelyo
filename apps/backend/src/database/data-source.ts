import "reflect-metadata";
import { config } from "dotenv";
import { DataSource } from "typeorm";

config();

const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT ?? "5432", 10),
  username: process.env.DB_USERNAME || "kelyo",
  password: process.env.DB_PASSWORD || "kelyo_dev_password",
  database: process.env.DB_NAME || "kelyo_dev",
  entities: [__dirname + "/../**/*.entity{.ts,.js}"],
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  synchronize: false,
  logging: process.env.DB_LOGGING === "true",
});

export default AppDataSource;
