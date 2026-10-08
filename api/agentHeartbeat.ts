import { withHandler } from "../server/http";
import { handleAgentHeartbeat } from "../server/handlers";

export default withHandler("POST", handleAgentHeartbeat);
