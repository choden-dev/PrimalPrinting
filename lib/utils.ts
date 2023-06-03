// https://stackoverflow.com/questions/6860853/generate-random-string-for-div-id
export const guidGenerator = () => {
    var S4 = function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return S4() + S4();
};

export const formatItems = (items): string => {
    const listItems = items.map((item) => {
        return `<li>${item.name} - Qty: ${item.quantity}, Cost: ${item.cost}</li>`;
    });

    const formattedString = listItems.join("");

    return formattedString;
};

export const orderSum = (orderItems) => {
    let sum = 0;
    orderItems.map((item) => {
        sum += item.cost;
    });
    return sum.toFixed(2);
};
