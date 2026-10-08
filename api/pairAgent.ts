import { withHandler } from "../server/http";
import { handlePairAgent } from "../server/handlers";

export default withHandler("POST", handlePairAgent);
