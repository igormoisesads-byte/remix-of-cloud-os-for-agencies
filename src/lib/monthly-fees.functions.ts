import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { updateClientDueDate } from "./monthly-fees.server";

export const updateDueDateFn = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    clientId: z.string(),
    newDay: z.number().min(1).max(31)
  }).parse(data))
  .handler(async ({ data }) => {
    return updateClientDueDate(data.clientId, data.newDay);
  });
