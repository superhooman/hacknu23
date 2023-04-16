import { prisma } from "../db";

export const getLatestTimestamp = async (model: 'sale' | 'supply', barcode: number) => {
    if (model === 'sale') {
        const data = await prisma.sale.findFirst({
            where: {
                barcode,
            },
            orderBy: {
                sale_time: 'desc',
            },
        });

        return data ? new Date(data.sale_time) : undefined;
    } else if (model === 'supply') {
        const data = await prisma.supply.findFirst({
            where: {
                barcode,
            },
            orderBy: {
                supply_time: 'desc',
            },
        });

        return data ? new Date(data.supply_time) : undefined;
    }
}
