import { saleSchema } from "@src/schemas/sale";
import { prisma } from "@src/server/db";
import { type NextApiHandler } from "next";
import { z } from "zod";

interface Report {
    barcode: number;
    quantity: string;
    revenue: string;
    netProfit: string;
}

const reportSchema = z.object({
    barcode: z.number(),
    quantity: z.preprocess((x) => parseInt(x as string, 10), z.number()),
    revenue: z.preprocess((x) => parseInt(x as string, 10), z.number()),
    netProfit: z.preprocess((x) => parseInt(x as string, 10), z.number()),
});

const getSchema = z.object({
    barcode: z.preprocess((x) => parseInt(x as string, 10), z.number()),
    fromTime: z.preprocess((x) => new Date(x as string), z.date()),
    toTime: z.preprocess((x) => new Date(x as string), z.date()),
});

const handler: NextApiHandler = async (req, res) => {
    if (req.method === "GET") {
        console.log('GET /api/reports');
        const parsed = getSchema.safeParse(req.query);

        if (!parsed.success) {
            return res.status(400).json({
                ok: false,
                error: parsed.error,
            });
        }

        const { barcode, fromTime, toTime } = parsed.data;

        const data = await prisma.$queryRaw<Report[]>`SELECT barcode, 
                                            sum(quantity) as quantity,
                                            sum(quantity * price) as revenue,
                                            sum(margin) as netProfit
                                            FROM Sale
                                            where barcode=${barcode} and
                                            sale_time >= ${fromTime} and
                                            sale_time <= ${toTime}
                                            group by barcode
                                            `;
        const report = data[0];

        if (!report) {
            return res.status(404).json({
                ok: false,
                error: 'Not found',
            });
        }

        const parseReport = reportSchema.parse(report);

        return res.status(200).json(parseReport);
    } 
}

export default handler;

