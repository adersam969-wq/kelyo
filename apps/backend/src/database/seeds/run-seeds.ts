import "reflect-metadata";
import AppDataSource from "../data-source";

async function runSeeds() {
  console.log("Running Kelyo seeds...");
  await AppDataSource.initialize();
  console.log("Seeds complete.");
  await AppDataSource.destroy();
  process.exit(0);
}

runSeeds().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
