import type { SupplySchema } from "@src/schemas/supply";
import { prisma } from "../db";
import { getLatestTimestamp } from "../utils/getLatestTimestamp";
import { type Sale } from "@prisma/client";
import { recalculate } from "../utils/recalculate";

const addToPresent = async (input: SupplySchema) => {
    const supply = await prisma.supply.create({
        data: {
            barcode: input.barcode,
            price: input.price,
            quantity: input.quantity,
            supply_time: input.supplyTime,
            remainder: input.quantity,
        }
    });

    return supply.id;
};

const addToPast = async (input: SupplySchema) => {
    const otherSupplies = await prisma.supply.findMany({
        where: {
            barcode: input.barcode,
            supply_time: {
                gte: input.supplyTime,
            }
        },
        orderBy: {
            supply_time: 'asc',
        }
    });
    console.log('---------------------')
    console.log('Adding Supply to the past')

    const mappings = (await prisma.mapping.findMany({
        where: {
            supply: {
                barcode: input.barcode,
                supply_time: {
                    gte: input.supplyTime,
                }
            }
        },
        orderBy: {
            id: 'asc',
        },
        select: {
            sale: true,
            start: true,
            end: true,
        },
    }));

    console.log('---------------------')
    console.log('Got mappings');

    const firstMapping = mappings[0];

    console.log('Got first mapping: ');
    console.log(firstMapping);

    await prisma.mapping.deleteMany({
        where: {
            supply: {
                barcode: input.barcode,
                supply_time: {
                    gte: input.supplyTime,
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
                barcode: input.barcode,
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

    console.log('GOT SALES');
    console.log(sales);

    const supply = await prisma.supply.create({
        data: {
            barcode: input.barcode,
            supply_time: input.supplyTime,
            quantity: input.quantity,
            price: input.price,
            remainder: input.quantity,
        },
    });

    const result = recalculate([supply, ...otherSupplies], sales, offset, true);

    console.log('RECALCULATED');
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

    return supply.id;
};

export const addSupply = async (supply: SupplySchema) => {
    const currentTimestamp = await getLatestTimestamp('sale', supply.barcode);
    if (!currentTimestamp || supply.supplyTime >= currentTimestamp) {
        return await addToPresent(supply);
    }
    return await addToPast(supply);
};
