import { withHandler } from "../server/http";
import { handleEnsureUserProfile } from "../server/handlers";

export default withHandler("POST", handleEnsureUserProfile);
