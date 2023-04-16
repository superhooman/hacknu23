import { type Mapping, type Sale, type Supply } from "@prisma/client";


export const recalculate = (supplies: Supply[], sales: Sale[], offset: number, isSupply?: boolean) => {
    let currentSupplyId = 0;
    let currentSaleId = 0;
    const mappings: Omit<Mapping, 'id' | 'order'>[] = [];

    const resetSale = (id: number) => {
        const sale = sales[id];
        if (!sale) return;

        sale.margin = sale.quantity * sale.price;
    }

    for (let i = 0; i < supplies.length; i++) {
        console.log('Going through supplies');
        const currentSupply = supplies[i]!;
        if (i === 0 && !isSupply) {
            currentSupply.remainder = currentSupply.quantity - offset; 
            console.log('Adjusting first supply remainder based on offset', { offset, remainder: currentSupply.remainder });
        } else {
            currentSupply.remainder = currentSupply.quantity;
        }
    }

    for (let i = 0; i < sales.length; i++) {
        resetSale(i);
    }

    if (supplies.length === 0 || sales.length === 0) return {
        supplies,
        sales,
        mappings,
    };

    while (currentSupplyId < supplies.length && currentSaleId < sales.length) {
        const currentSupply = supplies[currentSupplyId]!;
        const currentSale = sales[currentSaleId]!;

        if (currentSupply.remainder === 0) {
            currentSupplyId++;
            continue;
        }

        if (isSupply && currentSaleId === 0) {
            mappings.push({
                supply_id: currentSupply.id,
                sale_id: currentSale.id,
                start: currentSupply.quantity - currentSupply.remainder,
                end: (currentSupply.quantity - currentSupply.remainder) + offset,
            });
            
            currentSale.margin -= offset * currentSupply.price;
            currentSupply.remainder -= offset;

            currentSaleId++;
            resetSale(currentSaleId);
            continue;
        }

        if (currentSupply.remainder >= currentSale.quantity) {
            mappings.push({
                supply_id: currentSupply.id,
                sale_id: currentSale.id,
                start: currentSupply.quantity - currentSupply.remainder,
                end: (currentSupply.quantity - currentSupply.remainder) + currentSale.quantity,
            });

            currentSupply.remainder -= currentSale.quantity;
            currentSale.margin -= currentSale.quantity * currentSupply.price;
            currentSale.quantity = 0;
            currentSaleId++;
            resetSale(currentSaleId);

            console.log({
                mode: "supply > sale",
                currentSupplyId,
                currentSaleId,
                currentSupplyRemainder: currentSupply.remainder,
            });
        } else {
            mappings.push({
                supply_id: currentSupply.id,
                sale_id: currentSale.id,
                start: currentSupply.quantity - currentSupply.remainder,
                end: currentSupply.quantity,
            });

            currentSale.quantity -= currentSupply.remainder;
            currentSale.margin -= currentSupply.remainder * currentSupply.price;
            currentSupply.remainder = 0;
            currentSupplyId++;
            console.log({
                mode: "sale > supply",
                currentSupplyId,
                currentSaleId,
                currentSaleRemainder: currentSale.quantity,
            });
        }
    }

    return {
        supplies,
        sales,
        mappings,
    }
};
