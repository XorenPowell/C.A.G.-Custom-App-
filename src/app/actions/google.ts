"use server";

import { revalidatePath } from "next/cache";
import { disconnect } from "@/lib/google-calendar";

export async function disconnectGoogle() {
  await disconnect();
  revalidatePath("/settings/calendar");
}
