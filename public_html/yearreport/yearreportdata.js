import { getAccounts, getTransactionsForAccount, getStakingRewardsForAccountAndPool } from "../storage/domainobjectstore.js";
import { getStakingAccounts } from "../near/stakingpool.js";
import { getEODPrice, getCustomSellPrice, getCustomBuyPrice } from '../pricedata/pricedata.js';

export async function calculateYearReportData() {
    const accounts = await getAccounts();
    const accountTransactions = {};
    const transactionsByHash = {};
    const transactionsByDate = {};
    const allStakingAccounts = {};

    for (let account of accounts) {
        const transactions = await getTransactionsForAccount(account);
        for (let n = 0; n < transactions.length; n++) {
            const tx = transactions[n];
            tx.account = account;
            tx.changedBalance = BigInt(tx.balance) - (
                n < transactions.length - 1 ? BigInt(transactions[n + 1].balance) : BigInt(tx.balance)
            );
            if (!transactionsByHash[tx.hash]) {
                transactionsByHash[tx.hash] = [];
            }
            transactionsByHash[tx.hash].push(tx);

            const datestring = new Date(tx.block_timestamp / 1_000_000).toJSON().substring(0, 'yyyy-MM-dd'.length);
            if (!transactionsByDate[datestring]) {
                transactionsByDate[datestring] = [];
            }
            transactionsByDate[datestring].unshift(tx);
        }

        const stakingAccounts = await getStakingAccounts(account);

        accountTransactions[account] = {
            arr: transactions,
            stakingAccounts: stakingAccounts,
            stakingBalances: {},
        };

        for (let stakingAccount of stakingAccounts) {
            allStakingAccounts[stakingAccount] = true;
            const stakingRewards = await getStakingRewardsForAccountAndPool(account, stakingAccount);
            for (let stakingReward of stakingRewards) {
                const ts = stakingReward.timestamp.substr(0, 'yyyy-MM-dd'.length);
                const stakingBalances = accountTransactions[account].stakingBalances;
                if (!stakingBalances[ts]) {
                    stakingBalances[ts] = { totalStakingBalance: 0, totalEarnings: 0 };
                }
                if (stakingBalances[ts][stakingAccount] == undefined) {
                    stakingBalances[ts][stakingAccount] = stakingReward.balance;
                    stakingBalances[ts].totalStakingBalance += stakingReward.balance;
                }

                stakingBalances[ts].totalEarnings += stakingReward.earnings;
            }
        }
    }

    const dailyBalances = {};
    let prevDateString;
    let currentDate = new Date(2020, 0, 1);
    const endDate = new Date();
    const accountDailyBalances = {};
    while (currentDate.getTime() < endDate) {
        const datestring = currentDate.toJSON().substring(0, 'yyyy-MM-dd'.length);
        dailyBalances[datestring] = {
            totalBalance: 0,
            accountBalance: 0,
            stakingBalance: 0,
            stakingEarnings: 0,
            deposit: 0,
            withdrawal: 0
        };
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
        accounts.forEach(account => {
            const transactionsObj = accountTransactions[account];
            if (transactionsObj.stakingBalances[datestring]) {
                dailyBalances[datestring].stakingBalance += transactionsObj.stakingBalances[datestring].totalStakingBalance;
                dailyBalances[datestring].stakingEarnings += transactionsObj.stakingBalances[datestring].totalEarnings;
            } else if (prevDateString && transactionsObj.stakingBalances[prevDateString]) {
                dailyBalances[datestring].stakingBalance += transactionsObj.stakingBalances[prevDateString].totalStakingBalance;
            }
        });
        if (transactionsByDate[datestring]) {
            transactionsByDate[datestring].forEach(tx => {
                let changedBalanceForHashAllAccounts = BigInt(0);
                const allTxEntriesForHash = transactionsByHash[tx.hash];
                allTxEntriesForHash.forEach(t => {
                    changedBalanceForHashAllAccounts += t.changedBalance;
                    t.changedBalance = BigInt(0);
                });
                if (!allStakingAccounts[tx.signer_id] && !allStakingAccounts[tx.receiver_id]) {
                    if (changedBalanceForHashAllAccounts >= BigInt(0)) {
                        dailyBalances[datestring].deposit += Number(changedBalanceForHashAllAccounts);
                    } else {
                        dailyBalances[datestring].withdrawal += -Number(changedBalanceForHashAllAccounts);
                    }
                }
                accountDailyBalances[tx.account] = BigInt(tx.balance);
            });
        }
        dailyBalances[datestring].accountBalance = Object.values(accountDailyBalances).reduce((p, c) => p + c, BigInt(0));
        dailyBalances[datestring].totalBalance = dailyBalances[datestring].stakingBalance + Number(dailyBalances[datestring].accountBalance);
        dailyBalances[datestring].accounts = Object.assign({}, accountDailyBalances);
        if (prevDateString) {
            const totalChange = dailyBalances[datestring].totalBalance - dailyBalances[prevDateString].totalBalance;
            const accountChange = dailyBalances[datestring].accountBalance - dailyBalances[prevDateString].accountBalance;
            const stakingChange = dailyBalances[datestring].stakingBalance - dailyBalances[prevDateString].stakingBalance;
            const stakingRewards = dailyBalances[datestring].stakingEarnings;

            Object.assign(
                dailyBalances[datestring],
                {
                    totalChange: totalChange,
                    accountChange: accountChange,
                    stakingChange: stakingChange,
                    stakingRewards: stakingRewards
                });
        }
        prevDateString = datestring;
    }

    return dailyBalances;
}

export async function calculateProfitLoss(dailyBalances, targetCurrency = 'near') {
    if (targetCurrency == 'near') {
        return { dailyBalances };
    }
    const openPositions = [];
    const closedPositions = [];

    for (const datestring in dailyBalances) {
        const dailyEntry = dailyBalances[datestring];
        let dayProfit = 0;
        let dayLoss = 0;
        if (dailyEntry.deposit > 0 || dailyEntry.reward > 0) {
            const amount = dailyEntry.deposit ?? 0 + dailyEntry.reward ?? 0;
            const conversionRate = await getEODPrice(targetCurrency, datestring);
            openPositions.push({
                date: datestring,
                initialAmount: amount,
                remainingAmount: amount,
                convertedValue: conversionRate * (amount / 1e+24),
                conversionRate: conversionRate,
                realizations: []
            });
        }

        if (dailyEntry.withdrawal > 0) {
            let dayRealizedAmount = 0;

            dailyEntry.realizations = [];
            const conversionRate = await getCustomSellPrice(targetCurrency, datestring);
            while (openPositions.length > 0 && dayRealizedAmount < dailyEntry.withdrawal) {
                const position = openPositions[0];
                if ((dayRealizedAmount + position.remainingAmount) > dailyEntry.withdrawal) {
                    const partlyRealizedPositionAmount = (dailyEntry.withdrawal - dayRealizedAmount);
                    const partlyRealizedPositionInitialConvertedValue = position.convertedValue * (partlyRealizedPositionAmount / position.initialAmount);
                    const partlyRealizedPositionRealizedConvertedValue = (partlyRealizedPositionAmount / 1e+24) * conversionRate;
                    position.remainingAmount -= partlyRealizedPositionAmount;
                    dayRealizedAmount = dailyEntry.withdrawal;

                    const profitLoss = partlyRealizedPositionRealizedConvertedValue - partlyRealizedPositionInitialConvertedValue;
                    if (profitLoss >= 0) {
                        dayProfit += profitLoss;
                    } else {
                        dayLoss += -profitLoss;
                    }
                    const realizationEntry = {
                        date: datestring,
                        amount: partlyRealizedPositionAmount,
                        initialConvertedValue: partlyRealizedPositionInitialConvertedValue,
                        convertedValue: partlyRealizedPositionRealizedConvertedValue,
                        profit: profitLoss >= 0 ? profitLoss : 0,
                        conversionRate: conversionRate,
                        loss: profitLoss < 0 ? -profitLoss : 0,
                    };
                    position.realizations.push(realizationEntry);
                    dailyEntry.realizations.push(
                        Object.assign({}, realizationEntry, {
                            position: Object.assign({}, position, { realizations: undefined })
                        })
                    );
                } else {
                    dayRealizedAmount += position.remainingAmount;

                    const convertedValue = conversionRate * (position.remainingAmount / 1e+24);
                    const initialConvertedValue = position.convertedValue * (position.remainingAmount / position.initialAmount);
                    const profitLoss = convertedValue - initialConvertedValue;
                    if (profitLoss >= 0) {
                        dayProfit += profitLoss;
                    } else {
                        dayLoss += -profitLoss;
                    }
                    const realizationEntry = {
                        date: datestring,
                        amount: position.remainingAmount,
                        convertedValue: convertedValue,
                        initialConvertedValue,
                        conversionRate: conversionRate,
                        profit: profitLoss >= 0 ? profitLoss : 0,
                        loss: profitLoss < 0 ? -profitLoss : 0,
                    };
                    position.realizations.push(realizationEntry);
                    dailyEntry.realizations.push(
                        Object.assign({}, realizationEntry, {
                            position: Object.assign({}, position, { realizations: undefined })
                        })
                    );
                    position.remainingAmount = 0;
                    closedPositions.push(position);
                    openPositions.shift();
                }
            }

            dailyEntry.profit = dayProfit;
            dailyEntry.loss = dayLoss;
            if (dayRealizedAmount < dailyEntry.withdrawal) {
                console.error(`should not happen: withdrawn amount larger than available positions. wanted to withdraw: ${dailyEntry.withdrawal}, available: ${dayRealizedAmount}`);
            }
        }
    }
    return { openPositions, closedPositions, dailyBalances };
}

export async function getConvertedValuesForDay(rowdata, convertToCurrency, datestring) {
    const convertToCurrencyIsNEAR = convertToCurrency == 'near';
    const conversionRate = convertToCurrencyIsNEAR ? 1 : await getEODPrice(convertToCurrency, datestring);


    const stakingReward = (conversionRate * (rowdata.stakingRewards / 1e+24));
    const depositConversionRate = convertToCurrencyIsNEAR ? 1 : await getCustomBuyPrice(convertToCurrency, datestring);
    const deposit = (depositConversionRate * (rowdata.deposit / 1e+24));
    const withdrawalConversionRate = convertToCurrencyIsNEAR ? 1 : await getCustomSellPrice(convertToCurrency, datestring);
    const withdrawal = (withdrawalConversionRate * (rowdata.withdrawal / 1e+24));

    return { stakingReward, deposit, withdrawal, depositConversionRate, withdrawalConversionRate, conversionRate };
}