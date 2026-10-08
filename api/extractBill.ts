import { withHandler } from "../server/http";
import { handleExtractBill } from "../server/handlers";

export default withHandler("POST", handleExtractBill);
