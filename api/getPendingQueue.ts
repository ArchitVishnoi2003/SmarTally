import { withHandler } from "../server/http";
import { handleGetPendingQueue } from "../server/handlers";

export default withHandler("GET", handleGetPendingQueue);
