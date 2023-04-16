import { supplySchema } from "@src/schemas/supply";
import { prisma } from "@src/server/db";
import { addSupply } from "@src/server/methods/addSupply";
import { type NextApiHandler } from "next";
import { z } from "zod";

const getSchema = z.object({
    barcode: z.preprocess((x) => parseInt(x as string, 10), z.number()),
    fromTime: z.preprocess((x) => new Date(x as string), z.date()),
    toTime: z.preprocess((x) => new Date(x as string), z.date()),
});

const handler: NextApiHandler = async (req, res) => {
    if (req.method === "GET") {
        console.log('GET /api/supplies');
        const parsed = getSchema.safeParse(req.query);

        if (!parsed.success) {
            return res.status(400).json({
                ok: false,
                error: parsed.error,
            });
        }

        const { barcode, fromTime, toTime } = parsed.data;

        const data = await prisma.supply.findMany({
            where: {
                barcode,
                supply_time: {
                    gte: fromTime,
                    lte: toTime,
                },
            },
            orderBy: {
                supply_time: 'asc',
            },
        });

        return res.status(200).json(data);
    } else if (req.method === 'POST') {
        console.log('POST /api/supplies');
        const parsed = supplySchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                ok: false,
                error: parsed.error,
            });
        }

        const result = await addSupply(parsed.data);

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
