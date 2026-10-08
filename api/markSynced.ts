import { withHandler } from "../server/http";
import { handleMarkSynced } from "../server/handlers";

export default withHandler("POST", handleMarkSynced);
