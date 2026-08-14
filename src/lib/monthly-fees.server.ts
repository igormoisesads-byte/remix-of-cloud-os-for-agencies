import { supabase } from "@/integrations/supabase/client";

export async function updateClientDueDate(clientId: string, newDay: number) {
  // 1. Update the client's default due day
  const { error: clientError } = await supabase
    .from("clients")
    .update({ monthly_fee_day: newDay })
    .eq("id", clientId);

  if (clientError) throw clientError;

  // 2. Find pending or overdue fees (not paid, not cancelled)
  const { data: fees, error: feesError } = await supabase
    .from("monthly_fees")
    .select("id, due_date")
    .eq("client_id", clientId)
    .in("status", ["pendente", "atrasado"]);

  if (feesError) throw feesError;

  // 3. Update each fee's due_date to the new day of its respective month
  for (const fee of (fees || [])) {
    const currentDueDate = new Date(fee.due_date + "T00:00:00");
    const year = currentDueDate.getFullYear();
    const month = currentDueDate.getMonth();
    
    // Create new date with the same year and month but the new day
    // Handle months with fewer days than newDay (e.g. Feb 30 -> last day of month)
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const targetDay = Math.min(newDay, lastDayOfMonth);
    
    const newDueDate = new Date(year, month, targetDay).toISOString().split('T')[0];
    
    await supabase
      .from("monthly_fees")
      .update({ due_date: newDueDate })
      .eq("id", fee.id);
  }

  return { success: true };
}
