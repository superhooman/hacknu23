import { z } from "zod";

export const saleSchema = z.object({
    price: z.number(),
    quantity: z.number(),
    saleTime: z.preprocess((x) => new Date(x as string), z.date()),
    barcode: z.number(),
});

export type SaleSchema = z.infer<typeof saleSchema>;
