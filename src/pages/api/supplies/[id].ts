import { prisma } from "@src/server/db";
import { type NextApiHandler } from "next";
import { z } from "zod";
import { removeSupply } from "@src/server/methods/removeSupply";
import { supplySchema } from "@src/schemas/supply";
import { updateSupply } from "@src/server/methods/updateSupply";


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
        const data = await prisma.supply.findFirst({
            where: {
                id: id
            }
        })
        res.status(200).json(data);
    } else if (req.method === 'DELETE') {
        console.log('DELETE /api/supplies/[id]');
        await removeSupply(id);
        return res.status(200).end();
    } else if (req.method === 'PUT') {
        const data = supplySchema.safeParse(req.body);

        if (!data.success) {
            return res.status(400).json({
                ok: false,
                error: data.error,
            });
        }

        await updateSupply(id, data.data);

        return res.status(204).end();
    } else {
        return res.status(404).json({
            ok: false,
            error: 'Not found',
        })
    }
}

export default handler;
