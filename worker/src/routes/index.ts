import { Router } from "express";
import { healthRouter } from "./health";
import { snapshotRouter } from "./snapshot";
import { buildRouter } from "./build";
import { frameitRouter } from "./frameit";

export const workerRouter = Router();

workerRouter.use(healthRouter);
workerRouter.use(snapshotRouter);
workerRouter.use(buildRouter);
workerRouter.use(frameitRouter);
