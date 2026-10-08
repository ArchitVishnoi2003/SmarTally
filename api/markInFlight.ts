import { withHandler } from "../server/http";
import { handleMarkInFlight } from "../server/handlers";

export default withHandler("POST", handleMarkInFlight);
