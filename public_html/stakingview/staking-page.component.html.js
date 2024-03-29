export default /*html*/ `<style>
    .numeric {
        text-align: right;
    }

    .stakingrewardrow_datetime {
        white-space: nowrap;
    }

    .stakingrewardrow_balance {
        white-space: nowrap;
    }

    .table-responsive {
        max-height: 100%;
    }

    table thead,
    table tfoot {
        position: sticky;
    }

    table thead {
        inset-block-start: 0;
        top: 0;
    }

    table tfoot {
        inset-block-end: 0;
        bottom: 0;
    }
</style>
<template id="stakingpoolselectoption">
    <input type="radio" class="btn-check" name="stakingpoolselectoptions" autocomplete="off" checked>
    <label class="btn btn-outline-success"></label>
</template>
<h3>Staking balance and rewards</h3>
<div class="row">
<div class="col-md-6">
    <label for="accountselect" class="form-label">Account</label>
    <select class="form-select" aria-label="Select account" id="accountselect">
        <option disabled selected value>Select account</option>
    </select>
</div>
<div class="col-md-6">
    <label for="currencyselect" class="form-label">Currency</label>
    <select class="form-select" aria-label="Select currency" id="currencyselect">
        <option value="near">NEAR</option>
    </select>
</div>
<div id="stakingpoolselect">

</div>
<template id="stakingrewardrowtemplate">
    <tr>
        <td class="stakingrewardrow_datetime"></td>
        <td class="stakingrewardrow_balance numeric"></td>
        <td class="stakingrewardrow_earnings numeric"></td>
        <td class="stakingrewardrow_deposit numeric"></td>
        <td class="stakingrewardrow_withdrawal numeric"></td>
    </tr>
</template>
<div class="table-responsive">
    <table class="table table-sm">
        <thead class="table-dark">
            <th scope="col">
                date
            </th>
            <th scope="col">
                balance
            </th>
            <th scope="col">
                earnings
            </th>
            <th scope="col">
                deposits
            </th>
            <th scope="col">
                withdrawals
            </th>
        </thead>
        <tbody id="stakingrewardstable">

        </tbody>
        <tfoot class="table-dark">
            <th scope="col">
                
            </th>
            <th scope="col">
                
            </th>
            <th scope="col" id="totalEarnings" class="numeric">
                
            </th>
            <th scope="col" class="numeric">
                
            </th>
            <th scope="col" class="numeric">
                
            </th>
        </tfoot>
    </table>
</div>

</div>
`;