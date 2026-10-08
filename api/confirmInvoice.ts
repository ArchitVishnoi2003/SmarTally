import { withHandler } from "../server/http";
import { handleConfirmInvoice } from "../server/handlers";

export default withHandler("POST", handleConfirmInvoice);
