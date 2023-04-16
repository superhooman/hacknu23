import { prisma } from "../db";
import { type Sale, type Supply } from "@prisma/client";
import { recalculate } from "../utils/recalculate";
import { type SupplySchema } from "@src/schemas/supply";

export const updateSupply = async (id: number, data: SupplySchema) => {
    const supply = await prisma.supply.findUnique({
        where: {
            id,
        },
    });

    if (!supply) {
        throw new Error('Supply not found');
    }

    if (supply.barcode !== data.barcode) {
        throw new Error('Barcode cannot be changed');
    }

    const minDate = new Date(Math.min(supply.supply_time.getTime(), data.supplyTime.getTime()));
    console.log('Got min date');

    const otherSupplies = await prisma.supply.findMany({
        where: {
            barcode: supply.barcode,
            supply_time: {
                gte: minDate,
            },
            id: {
                not: id,
            },
        },
        orderBy: {
            supply_time: 'asc',
        },
    });
    console.log('othersupplies length', otherSupplies.length);

    const firstMapping = await prisma.mapping.findFirst({
        where: {
            supply: {
                barcode: supply.barcode,
                supply_time: {
                    gte: minDate,
                }
            },
        },
        orderBy: {
            id: 'asc'
        },
        select: {
            sale: true,
            start: true,
            end: true,
        }
    });

    console.log('Got first mapping');
    console.log(firstMapping);

    const supplies = [{
        ...supply,
        supply_time: data.supplyTime,
        price: data.price,
        quantity: data.quantity,
    }, ...otherSupplies].sort((a, b) => a.supply_time.getTime() - b.supply_time.getTime());

    console.log(supplies);

    await prisma.mapping.deleteMany({
        where: {
            supply: {
                barcode: supply.barcode,
                supply_time: {
                    gte: minDate,
                }
            }
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

    const result = recalculate(supplies, sales, offset, true);

    console.log(JSON.stringify(result, null, 2))

    await prisma.$transaction([
        ...result.supplies.map(({ id, remainder }) => prisma.supply.update({
            where: {
                id,
            },
            data: {
                remainder,
                ...(id === supply.id ? {
                    price: data.price,
                    quantity: data.quantity,
                    supply_time: data.supplyTime,
                } : {})
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
};