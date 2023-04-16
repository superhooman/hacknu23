import { removeSale } from "@src/server/methods/removeSale";
import { prisma } from "@src/server/db";
import { type NextApiHandler } from "next";
import { z } from "zod";
import { saleSchema } from "@src/schemas/sale";
import { updateSale } from "@src/server/methods/updateSale";

const paramSchema = z.object({
    id: z.preprocess((x) => parseInt(x as string, 10), z.number()),
});

const handler: NextApiHandler = async (req, res) => {
    const parsed = paramSchema.safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({
            ok: false,
            error: parsed.error,
        });
    }

    const { id } = parsed.data;

    if (req.method === 'GET') {
        const data = await prisma.sale.findFirst({
            where: {
                id: id
            }
        })
        return res.status(200).json(data);
    } else if (req.method === 'DELETE') {
        console.log('DELETE /api/sales/[id]');
        await removeSale(id);
        return res.status(204).end();
    } else if (req.method === 'PUT') {
        const data = saleSchema.safeParse(req.body);

        if (!data.success) {
            return res.status(400).json({
                ok: false,
                error: data.error,
            });
        }

        await updateSale(id, data.data);

        return res.status(204).end();
    } else {
        return res.status(404).json({
            ok: false,
            error: 'Not found',
        })
    }
}

export default handler;
