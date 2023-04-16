import { z } from "zod";

export const supplySchema = z.object({
    price: z.preprocess((x) => parseFloat(x as string), z.number()),
    quantity: z.preprocess((x) => parseInt(x as string, 10), z.number()),
    supplyTime: z.preprocess((x) => new Date(x as string), z.date()),
    barcode: z.preprocess((x) => parseInt(x as string, 10), z.number()),
});

export type SupplySchema = z.infer<typeof supplySchema>;
