import { z } from "zod";
export const handlingSchema = z.enum(["STANDARD", "PERISHABLE", "COLD_CHAIN", "BULK"]);
export const packagingSchema = z
  .object({
    unitsPerPackage: z.number().finite().positive().max(1_000_000).multipleOf(0.001),
    weightKg: z.number().finite().positive().max(1_000_000),
    length: z.number().finite().positive().max(1000),
    width: z.number().finite().positive().max(1000),
    height: z.number().finite().positive().max(1000),
    handling: handlingSchema,
    specialHandling: z.array(z.enum(["FRAGILE", "VENTILATED", "UPRIGHT", "SHADE", "NON_STACKABLE"])).max(5).optional(),
    pickupInstructions: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(500).default(""),
  })
  .strict();
export type Packaging = z.infer<typeof packagingSchema>;
