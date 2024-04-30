import { calculateYearReportData, calculateProfitLoss, getConvertedValuesForDay, getFungibleTokenConvertedValuesForDay, getDecimalConversionValue } from './yearreportdata.js';

const numDecimals = 2;

export function getNumberFormatter(currency) {
    const format = currency ? Intl.NumberFormat(navigator.language, { style: 'currency', currency: currency }).format :
        Intl.NumberFormat(navigator.language).format;
    return (number) => number !== null && number !== undefined && !isNaN(number) ? format(number) : '';;
}

export function hideProfitLossIfNoConvertToCurrency(convertToCurrency, shadowRoot) {
    if (!convertToCurrency) {
        const style = document.createElement('style');
        style.innerHTML = `
.profit, .loss, .summary_profit, .summary_loss, .dailybalancerow_profit, .dailybalancerow_loss, #summarytablefooter {
    display: none;
}
        `;
        shadowRoot.appendChild(style);
    }
}

export async function renderYearReportTable({ shadowRoot, token, year, convertToCurrency, perRowFunction }) {
    let { dailyBalances, transactionsByDate } = await calculateYearReportData(token);
    dailyBalances = (await calculateProfitLoss(dailyBalances, convertToCurrency, token)).dailyBalances;

    const yearReportData = dailyBalances;
    const yearReportTable = shadowRoot.querySelector('#dailybalancestable');

    while (yearReportTable.lastElementChild) {
        yearReportTable.removeChild(yearReportTable.lastElementChild);
    }

    const rowTemplate = shadowRoot.querySelector('#dailybalancerowtemplate');

    const formatNumber = getNumberFormatter(convertToCurrency);

    let currentDate = new Date().getFullYear() === year ? new Date(new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toJSON().substring(0, 'yyyy-MM-dd'.length)) : new Date(`${year}-12-31`);
    const endDate = new Date(`${year}-01-01`);

    let totalStakingReward = 0;
    let totalReceived = 0;
    let totalDeposit = 0;
    let totalWithdrawal = 0;
    let totalProfit = 0;
    let totalLoss = 0;

    const decimalConversionValue = token ? getDecimalConversionValue(token) : Math.pow(10, -24);
    const tokenNumberFormatter = getNumberFormatter();
    const symbol = token === '' ? 'NEAR' : token;
    const formatTokenAmount = (amount) => {
        return `<span class="token_amount">${tokenNumberFormatter(amount * decimalConversionValue)} ${symbol}</span>`;
    };

    while (currentDate.getTime() >= endDate) {
        const datestring = currentDate.toJSON().substring(0, 'yyyy-MM-dd'.length);

        const row = rowTemplate.cloneNode(true).content;
        const rowdata = yearReportData[datestring];

        const { stakingReward, received, deposit, withdrawal, conversionRate } = token ?
            await getFungibleTokenConvertedValuesForDay(rowdata, token, convertToCurrency, datestring) :
            await getConvertedValuesForDay(rowdata, convertToCurrency, datestring);

        totalStakingReward += stakingReward;
        totalDeposit += deposit;
        totalReceived += received;
        totalWithdrawal += withdrawal;
        totalProfit += rowdata.profit ?? 0;
        totalLoss += rowdata.loss ?? 0;

        rowdata.convertedTotalBalance = conversionRate * (rowdata.totalBalance * decimalConversionValue);
        rowdata.convertedAccountBalance = conversionRate * (Number(rowdata.accountBalance) * decimalConversionValue);
        rowdata.convertedStakingBalance = conversionRate * (rowdata.stakingBalance * decimalConversionValue);
        rowdata.convertedTotalChange = conversionRate * (rowdata.totalChange * decimalConversionValue);
        rowdata.convertedAccountChange = conversionRate * (Number(rowdata.accountChange) * decimalConversionValue);
        rowdata.convertedStakingChange = conversionRate * (rowdata.stakingChange * decimalConversionValue);

        row.querySelector('.dailybalancerow_datetime').innerText = datestring;
        row.querySelector('.dailybalancerow_totalbalance').innerHTML = `${formatNumber(rowdata.convertedTotalBalance)} ${convertToCurrency ? `<br />${formatTokenAmount(rowdata.totalBalance)}` : ''}`;
        row.querySelector('.dailybalancerow_accountbalance').innerHTML = `${formatNumber(rowdata.convertedAccountBalance)} ${convertToCurrency ? `<br />${formatTokenAmount(Number(rowdata.accountBalance))}` : ''}`;
        row.querySelector('.dailybalancerow_stakingbalance').innerHTML = `${formatNumber(rowdata.convertedStakingBalance)} ${convertToCurrency ? `<br />${formatTokenAmount(rowdata.stakingBalance)}` : ''}`;
        row.querySelector('.dailybalancerow_change').innerHTML = `${formatNumber(rowdata.convertedTotalChange)} ${convertToCurrency ? `<br />${formatTokenAmount(rowdata.totalChange)}` : ''}`;
        row.querySelector('.dailybalancerow_accountchange').innerHTML = `${formatNumber(rowdata.convertedAccountChange)} ${convertToCurrency ? `<br />${formatTokenAmount(Number(rowdata.accountChange))}` : ''}`;
        row.querySelector('.dailybalancerow_stakingchange').innerHTML = `${formatNumber(rowdata.convertedStakingChange)} ${convertToCurrency ? `<br />${formatTokenAmount(rowdata.stakingChange)}` : ''}`;
        row.querySelector('.dailybalancerow_stakingreward').innerHTML = `${formatNumber(stakingReward)} ${convertToCurrency ? `<br />${formatTokenAmount(rowdata.stakingRewards)}` : ''}`;
        row.querySelector('.dailybalancerow_received').innerHTML = `${formatNumber(received)} ${convertToCurrency ? `<br />${formatTokenAmount(Number(rowdata.received))}` : ''}`;
        row.querySelector('.dailybalancerow_deposit').innerHTML = `${formatNumber(deposit)} ${convertToCurrency ? `<br />${formatTokenAmount(rowdata.deposit)}` : ''}`;
        row.querySelector('.dailybalancerow_withdrawal').innerHTML = `${formatNumber(withdrawal)} ${convertToCurrency ? `<br />${formatTokenAmount(rowdata.withdrawal)}` : ''}`;
        if (convertToCurrency) {
            row.querySelector('.dailybalancerow_profit').innerText = formatNumber(rowdata.profit) ?? '';
            row.querySelector('.dailybalancerow_loss').innerText = formatNumber(rowdata.loss) ?? '';
        }

        await perRowFunction({ transactionsByDate, datestring, row, decimalConversionValue, numDecimals });

        if (rowdata.realizations) {
            const detailInfoElement = row.querySelector('.inforow td table tbody');
            detailInfoElement.innerHTML = rowdata.realizations.map(r => `
                <tr>
                    <td>${r.position.date}</td>
                    <td>${formatTokenAmount(r.position.initialAmount)}</td>
                    <td>${formatNumber(r.position.conversionRate)}</td>
                    <td>${formatTokenAmount(r.amount)}</td>
                    <td>${formatNumber(r.conversionRate)}</td>
                </tr>
            `).join('\n');
        } else {
            row.querySelector('.inforow').remove();
        }

        if (datestring.endsWith('12-31') || datestring.endsWith('01-01') ||
            rowdata.totalChange !== 0 ||
            received !== 0 ||
            deposit !== 0 ||
            withdrawal !== 0
        ) {
            yearReportTable.appendChild(row);
        }

        currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
        shadowRoot.querySelector('#totalreward').innerHTML = `${formatNumber(totalStakingReward)}`;
        shadowRoot.querySelector('#totalreceived').innerHTML = `${formatNumber(totalReceived)}`;
        shadowRoot.querySelector('#totaldeposit').innerHTML = `${formatNumber(totalDeposit)}`;
        shadowRoot.querySelector('#totalwithdrawal').innerHTML = `${formatNumber(totalWithdrawal)}`;
        if (convertToCurrency) {
            shadowRoot.querySelector('#totalprofit').innerText = formatNumber(totalProfit);
            shadowRoot.querySelector('#totalloss').innerText = formatNumber(totalLoss);
        }
    }
    return {
        totalStakingReward,
        totalReceived,
        totalDeposit,
        totalWithdrawal,
        totalProfit,
        totalLoss,
        outboundBalance: dailyBalances[`${year}-12-31`],
        inboundBalance: dailyBalances[`${year}-01-01`]
    }
}
