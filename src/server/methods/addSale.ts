import { Sale, type Mapping, Supply } from "@prisma/client";
import { prisma } from "../db";
import { getLatestTimestamp } from "../utils/getLatestTimestamp";
import { type SaleSchema } from "@src/schemas/sale";
import { recalculate } from "../utils/recalculate";

const addToPresent = async (input: SaleSchema) => {
    const openSupply = await prisma.supply.findMany({
        where: {
            barcode: input.barcode,
            remainder: {
                gt: 0,
            }
        },
        orderBy: {
            supply_time: 'asc',
        }
    });
    const updates: { id: number, remainder: number }[] = [];
    const mappings: Omit<Mapping, 'sale_id' | 'id'>[] = [];

    let remainder = input.quantity;
    let margin = input.quantity * input.price;

    for (const supply of openSupply) {
        if (remainder === 0) break;
        if (remainder >= supply.remainder) {
            remainder -= supply.remainder;
            margin -= supply.remainder * supply.price;
            updates.push({
                id: supply.id,
                remainder: 0,
            });
            mappings.push({
                supply_id: supply.id,
                start: supply.quantity - supply.remainder,
                end: supply.quantity,
                // count: supply.remainder,
            });
        } else {
            updates.push({
                id: supply.id,
                remainder: supply.remainder - remainder,
            });
            mappings.push({
                supply_id: supply.id,
                start: supply.quantity - supply.remainder,
                end: supply.quantity - supply.remainder + remainder,
            });
            margin -= remainder * supply.price;
            remainder = 0;
        }
    }
    
    const sale = await prisma.sale.create({
        data: {
            barcode: input.barcode,
            sale_time: input.saleTime,
            quantity: input.quantity,
            price: input.price,
            margin,
        },
    });

    await prisma.$transaction([
        ...updates.map(({ id, remainder }) => prisma.supply.update({
            where: {
                id,
            },
            data: {
                remainder,
            },
        })),
        ...mappings.map(mapping => prisma.mapping.create({
            data: {
                ...mapping,
                sale_id: sale.id,
            },
        })),
    ]);

    return sale.id;
};

const addToPast = async (input: SaleSchema) => {
    const otherSales = await prisma.sale.findMany({
        where: {
            barcode: input.barcode,
            sale_time: {
                gte: input.saleTime,
            }
        },
        orderBy: {
            sale_time: 'asc',
        }
    });
    console.log({otherSales});

    const firstMapping = await prisma.mapping.findFirst({
        where: {
            sale: {
                barcode: input.barcode,
                sale_time: {
                    gte: input.saleTime,
                }
            }
        },
        orderBy: {
            id: 'asc'
        },
        select: {
            supply: true,
            start: true,
            end: true,
        }
    });

    await prisma.mapping.deleteMany({
        where: {
            sale: {
                barcode: input.barcode,
                sale_time: {
                    gte: input.saleTime,
                }
            }
        }
    });

    console.log({firstMapping});

    const supplies: Supply[] = [];
    let offset = 0;

    if (firstMapping) {
        supplies.push(firstMapping.supply);
        offset = firstMapping.start;

        const otherSupplies = await prisma.supply.findMany({
            where: {
                barcode: input.barcode,
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

    console.log({supplies});

    const sale = await prisma.sale.create({
        data: {
            barcode: input.barcode,
            sale_time: input.saleTime,
            quantity: input.quantity,
            price: input.price,
            margin: input.quantity * input.price,
        },
    });
    console.log({sale});

    const result = recalculate(supplies, [sale, ...otherSales], offset);
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

    return sale.id;
};

export const addSale = async (sale: SaleSchema) => {
    const currentTimestamp = await getLatestTimestamp('sale', sale.barcode);
    if (!currentTimestamp || sale.saleTime >= currentTimestamp) {
        return await addToPresent(sale);
    }
    return await addToPast(sale);
};
