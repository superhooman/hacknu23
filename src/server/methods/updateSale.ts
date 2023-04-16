import type { SaleSchema } from "@src/schemas/sale";
import { prisma } from "../db";
import { type Supply } from "@prisma/client";
import { recalculate } from "../utils/recalculate";

export const updateSale = async (id: number, data: SaleSchema) => {
    const sale = await prisma.sale.findUnique({
        where: {
            id,
        },
    });

    if (!sale) {
        throw new Error('Sale not found');
    }

    if (sale.barcode !== data.barcode) {
        throw new Error('Barcode cannot be changed');
    }

    const minDate = new Date(Math.min(sale.sale_time.getTime(), data.saleTime.getTime()));
    console.log('Got min date');

    const otherSales = await prisma.sale.findMany({
        where: {
            barcode: sale.barcode,
            sale_time: {
                gte: minDate,
            },
            id: {
                not: id,
            },
        },
        orderBy: {
            sale_time: 'asc',
        },
    });
    console.log('Othersales length', otherSales.length);

    const firstMapping = await prisma.mapping.findFirst({
        where: {
            sale: {
                barcode: sale.barcode,
                sale_time: {
                    gte: minDate,
                }
            },
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

    console.log('Got first mapping');
    console.log(firstMapping);

    const sales = [{
        ...sale,
        sale_time: data.saleTime,
        price: data.price,
        quantity: data.quantity,
    }, ...otherSales].sort((a, b) => a.sale_time.getTime() - b.sale_time.getTime());

    console.log(sales);

    await prisma.mapping.deleteMany({
        where: {
            sale: {
                barcode: sale.barcode,
                sale_time: {
                    gte: minDate,
                }
            }
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

    const result = recalculate(supplies, sales, offset);

    console.log(JSON.stringify(result, null, 2))

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
                ...(id === sale.id ? {
                    sale_time: data.saleTime,
                    price: data.price,
                    quantity: data.quantity,
                } : {})
            },
        }))
    ]);
};