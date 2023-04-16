import { type Supply } from "@prisma/client";
import { prisma } from "../db";
import { recalculate } from "../utils/recalculate";

export const removeSale = async (id: number) => {
    const sale = await prisma.sale.findUnique({
        where: {
            id,
        },
    });

    if (!sale) {
        throw new Error('Sale not found');
    }

    const otherSales = await prisma.sale.findMany({
        where: {
            barcode: sale.barcode,
            sale_time: {
                gt: sale.sale_time,
            }
        },
        orderBy: {
            sale_time: 'asc',
        }
    });

    const firstMapping = await prisma.mapping.findFirst({
        where: {
            sale_id: sale.id,
        },
        orderBy: {
            id: 'asc'
        },
        select: {
            supply: true,
            start: true,
            end: true,
            id: true,
        }
    });

    await prisma.mapping.deleteMany({
        where: {
            sale: {
                barcode: sale.barcode,
                sale_time: {
                    gte: sale.sale_time,
                }
            }
        }
    });

    await prisma.sale.delete({
        where: {
            id,
        }
    });

    const supplies: Supply[] = [];
    let offset = 0;

    if (firstMapping) {
        supplies.push(firstMapping.supply);
        offset = firstMapping.start;

        const otherSupplies = await prisma.supply.findMany({
            where: {
                barcode: sale.barcode,
                supply_time: {
                    gt: firstMapping.supply.supply_time,
                }
            },
            orderBy: {
                supply_time: 'asc',
            }
        });

        supplies.push(...otherSupplies);
    }

    const result = recalculate(supplies, otherSales, offset);
    console.log(JSON.stringify(result, null, 2));

    await prisma.$transaction([
        ...result.supplies.map(({ id, remainder }) => prisma.supply.update({
            where: {
                id,
            },
            data: {
                remainder,
            },
        })),
        ...result.mappings.map(mapping => prisma.mapping.create({
            data: mapping,
        })),
        ...result.sales.map(({ id, margin }) => prisma.sale.update({
            where: {
                id,
            },
            data: {
                margin,
            },
        }))
    ]);
}