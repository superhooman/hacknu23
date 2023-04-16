import { type Sale } from "@prisma/client";
import { prisma } from "../db";
import { recalculate } from "../utils/recalculate";

export const removeSupply = async (id: number) => {
    const supply = await prisma.supply.findUnique({
        where: {
            id,
        },
    });

    if (!supply) {
        throw new Error('Sale not found');
    }

    const otherSupplies = await prisma.supply.findMany({
        where: {
            barcode: supply.barcode,
            supply_time: {
                gt: supply.supply_time,
            }
        },
        orderBy: {
            supply_time: 'asc',
        }
    });

    const firstMapping = await prisma.mapping.findFirst({
        where: {
            supply_id: supply.id,
        },
        orderBy: {
            id: 'asc'
        },
        select: {
            sale: true,
            start: true,
            end: true,
            id: true,
        }
    });

    await prisma.mapping.deleteMany({
        where: {
            supply: {
                barcode: supply.barcode,
                supply_time: {
                    gte: supply.supply_time,
                }
            }
        }
    });

    await prisma.supply.delete({
        where: {
            id,
        }
    });

    const sales: Sale[] = [];
    let offset = 0;

    if (firstMapping) {
        sales.push(firstMapping.sale);
        offset = firstMapping.end - firstMapping.start;

        const otherSales = await prisma.sale.findMany({
            where: {
                barcode: supply.barcode,
                sale_time: {
                    gt: firstMapping.sale.sale_time,
                }
            },
            orderBy: {
                sale_time: 'asc',
            }
        });

        sales.push(...otherSales);
    }

    const result = recalculate(otherSupplies, sales, offset, true);
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
