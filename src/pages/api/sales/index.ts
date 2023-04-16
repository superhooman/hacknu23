import { saleSchema } from "@src/schemas/sale";
import { prisma } from "@src/server/db";
import { addSale } from "@src/server/methods/addSale";
import { type NextApiHandler } from "next";
import { z } from "zod";

const getSchema = z.object({
    barcode: z.preprocess((x) => parseInt(x as string, 10), z.number()),
    fromTime: z.preprocess((x) => new Date(x as string), z.date()),
    toTime: z.preprocess((x) => new Date(x as string), z.date()),
});

const handler: NextApiHandler = async (req, res) => {
    if (req.method === "GET") {
        console.log('GET /api/sales');
        const parsed = getSchema.safeParse(req.query);

        if (!parsed.success) {
            return res.status(400).json({
                ok: false,
                error: parsed.error,
            });
        }

        const { barcode, fromTime, toTime } = parsed.data;

        const data = await prisma.sale.findMany({
            where: {
                barcode,
                sale_time: {
                    gte: fromTime,
                    lte: toTime,
                },
            },
            orderBy: {
                sale_time: 'asc',
            },
        });

        return res.status(200).json(data);
    } else if (req.method === 'POST') {
        console.log('POST /api/sales');
        const parsed = saleSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                ok: false,
                error: parsed.error,
            });
        }

        const result = await addSale(parsed.data);

        return res.status(200).json({
            id: result,
        });
    } else {
        return res.status(404).json({
            ok: false,
            error: 'Not found',
        })
    }
}

export default handler;
