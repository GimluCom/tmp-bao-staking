// --- config ---
const useChainID = "0x1"; // mainnet:0x1, xDai:0x64
const tokenContractAddresses = [
    "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2",  // Bao token
    "0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272",  // tBao token
];
const stakingContractAddress = tokenContractAddresses[1];  // staking contract is equal to token contract
const tokenSymbols = [
    "Bao",
    "tBao",
];
const tokenBalanceInterval = 30100;  // ms
// --- end config ---



function dec2wei(str, weiDecimals=18) {
    if (!(str.match(/^\d+\.?\d{0,18}$/))) {return;}
    if (!(str.includes('.'))) {str = str+'.0';}
    if (str.split('.')[1].length > weiDecimals) {
        str = str.split('.')[0]+'.'+str.split('.')[1].substring(0, weiDecimals);
    }
    while (str.split('.')[1].length < weiDecimals) {str = str+'0';}
    str = str.split('.')[0]+str.split('.')[1];
    return str;
}
function dec2hex(str, weiDecimals=18) {
    return BigInt(dec2wei(str, weiDecimals)).toString('16');
}
function hex2dec(str) {
    if (str.substring(0, 2) !== "0x") {str = "0x"+str;}
    while (str.substring(0, 3) === "0x0") {str = "0x"+str.substring(3);}
    if (str === "0x") {str = "0x0";}
    return BigInt(str).toString();
}
function wei2dec(wei, roundDecimal=18, weiDecimals=18, removeZeros=false) {
    while (wei.length < weiDecimals+1) {wei = '0'+wei;}
    let pos = wei.length-weiDecimals;
    wei = [wei.slice(0, pos), '.', wei.slice(pos, pos+roundDecimal)].join('');
    if (removeZeros) {
        while (wei.substring(wei.length-1, wei.length) === '0') {
            wei = wei.substring(0, wei.length-1);
        }
    }
    if (wei.substring(wei.length-1, wei.length) === '.') {
        wei = wei.substring(0, wei.length-1);
    }
    return wei;
}
function zeroPadHex(str) {
    str = str.toString().toLowerCase();
    if (str.substring(0, 2) === "0x") {str = str.substring(2);}
    while (str.length < 64) {str = '0'+str;}
    return str;
}
let accounts = null;
window.addEventListener('load', function () {
    const inputFields = document.querySelectorAll('input.inputField');
    for (let i = 0; i < inputFields.length; i++) {
        inputFields[i].addEventListener('keypress', e => {
            if ("1234567890.".indexOf(e.key) < 0) {
                e.preventDefault();
                return false;
            } else if (inputFields[i].value.includes(".")) {
                if (e.key === ".") {
                    e.preventDefault();
                    return false;
                } else if (inputFields[i].value.split(".")[1].length >= 18) {
                    e.preventDefault();
                    return false;
                }
            }
            return true;
        });
    }
});
async function connectMM() {
    accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    const chainId = await ethereum.request({ method: 'eth_chainId' });
    handleChainChanged(chainId);
    ethereum.on('chainChanged', handleChainChanged);
}
let defaultChainParameters = {};
defaultChainParameters["0x1"] = {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    blockExplorerUrls: ['https://etherscan.io'],
    rpcUrls: ['https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'],
    iconUrls: [],
    nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
    }
};
let chainParameters = {};
chainParameters["0x64"] = {
    chainId: '0x64',
    chainName: 'xDai Chain',
    blockExplorerUrls: ['https://blockscout.com/xdai/mainnet'],
    rpcUrls: ['https://rpc.xdaichain.com'],
    iconUrls: ['https://gblobscdn.gitbook.com/spaces%2F-Lpi9AHj62wscNlQjI-l%2Favatar.png'],
    nativeCurrency: {
        name: 'xDai',
        symbol: 'xDAI',
        decimals: 18
    }
};
let checkBalanceInterval;
function handleChainChanged(_chainId) {
    const MMStatus = document.getElementById('MMStatusPar');
    const btnChangeNetwork = document.getElementById('btnChangeNetwork');
    const btnDivInner = document.getElementById('btnDivInner');
    const btnTokens = [document.getElementById('btnToken0'), document.getElementById('btnToken1')];
    btnTokens.forEach(btnToken => {
        btnToken.classList.add('disabled');
        btnToken.disabled = true;
    })
    btnChangeNetwork.classList.add('d-none');
    btnDivInner.classList.remove('border-success');
    clearInterval(checkBalanceInterval);
    clearTimeout(allowanceTimer);
    if (_chainId === useChainID) {
        setTimeout(getTokenBalances, 700);
        setInterval(checkBalanceInterval, tokenBalanceInterval);
        MMStatus.innerHTML = "Connected!";
        btnDivInner.classList.remove('border-danger');
        btnDivInner.classList.add('border-success');
        btnTokens.forEach(btnToken => {
            btnToken.classList.remove('disabled');
            btnToken.disabled = false;
        });
        allowanceTimer = setTimeout(checkAllowance, 500);
    } else if (typeof chainParameters[useChainID] !== 'undefined') {
        MMStatus.innerHTML = "Wrong network detected!<br>Click the button below to change it:";
        btnChangeNetwork.classList.remove('d-none');
        btnDivInner.classList.add('border-danger');
    } else if (typeof defaultChainParameters[useChainID] !== 'undefined') {
        MMStatus.innerHTML = 'Wrong network detected!<br><br>Please select network<br>"'+defaultChainParameters[useChainID]["chainName"]+'"<br>in Metamask.';
        btnDivInner.classList.add('border-danger');
    } else {
        MMStatus.innerHTML = "Wrong network detected!";
        btnDivInner.classList.add('border-danger');
    }
}
async function addNetwork() {
    if (typeof window.ethereum == 'undefined') {
        return;
    }
    // chainError is null if successful, and an error otherwise
    let chainError = await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [chainParameters[useChainID]],
    });
}
let tokenBalances = ['', ''];
let tokenBalancesFull = ['', ''];
let tokenAllowances = ['0', '0'];
async function getTokenBalances() {
    let transactionParameters = [{}, {}];
    transactionParameters[0] = {
        nonce: '0x00',
        //gasPrice: '0x3b9aca00',
        gas: '0x186a0',
        to: tokenContractAddresses[0].toLowerCase(),
        from: accounts[0],
        value: '0x0',
        data: '0x70a08231'+zeroPadHex(accounts[0]),
        //chainId: useChainID,
    };
    transactionParameters[1] = {
        nonce: '0x00',
        //gasPrice: '0x3b9aca00',
        gas: '0x186a0',
        to: tokenContractAddresses[1].toLowerCase(),
        from: accounts[0],
        value: '0x0',
        data: '0x70a08231'+zeroPadHex(accounts[0]),
        //chainId: useChainID,
    };
    let call_response;
    call_response = await ethereum.request({
        method: 'eth_call',
        params: [transactionParameters[0]],
    });
    if (call_response) {
        tokenBalances[0] = wei2dec(hex2dec(call_response), 2, 18, true);
        tokenBalancesFull[0] = wei2dec(hex2dec(call_response), 18, 18, true);
    }
    call_response = await ethereum.request({
        method: 'eth_call',
        params: [transactionParameters[1]],
    });
    if (call_response) {
        tokenBalances[1] = wei2dec(hex2dec(call_response), 2, 18, true);
        tokenBalancesFull[1] = wei2dec(hex2dec(call_response), 18, 18,true);
    }
    document.getElementById('tokenBalance1').innerHTML = tokenBalances[0].toString();
    document.getElementById('tokenBalance2').innerHTML = tokenBalances[1].toString();
}
async function getMaxAmount(tokenId) {
    const amountInputs = [document.getElementById('stakeAmount'), document.getElementById('unstakeAmount')];
    await getTokenBalances();
    amountInputs[tokenId].value = tokenBalancesFull[tokenId];
}
async function getPendingTxs() {
    const transactionParameters = [
        accounts[0].toString().toLowerCase(),
        'pending',
        //chainId: useChainID,
    ];
    const pendingTxs = await ethereum.request({
        method: 'eth_getTransactionCount',
        params: [transactionParameters],
    });
}
let allowanceTimer = null;
let needsAllowance = ['true', 'false']
function checkAllowanceTimeout(timeout=true) {
    if (timeout) {
        clearTimeout(allowanceTimer);
        allowanceTimer = setTimeout(checkAllowance, 2900);
    }
    const inputFields = document.querySelectorAll('input.inputField');
    const btnTokens = [document.getElementById('btnToken0')];
    let inputValue = inputFields[0].value
    if (typeof inputValue === 'undefined' || inputValue.length < 1 || isNaN(inputValue)) {inputValue = '0';}
    if (BigInt(tokenAllowances[0]) < BigInt(dec2wei(inputValue)) || BigInt(tokenAllowances[0]) < BigInt('1')) {
        btnTokens[0].innerHTML = "Approve";
        needsAllowance[0] = 'true';
        if (!(timeout)) {allowanceTimer = setTimeout(checkAllowance, 17000);}
    } else {
        btnTokens[0].innerHTML = "Stake";
        needsAllowance[0] = 'false';
        btnTokens[0].classList.remove('disabled');
        btnTokens[0].disabled = false;
    }
}
async function checkAllowance() {
    let transactionParameters = [];
    transactionParameters[0] = {
        nonce: '0x00',
        //gasPrice: '0x3b9aca00',
        gas: '0x186a0',
        to: tokenContractAddresses[0].toLowerCase(),
        from: accounts[0],
        value: '0x0',
        data: '0xdd62ed3e'+zeroPadHex(accounts[0])+zeroPadHex(stakingContractAddress),
        //chainId: useChainID,
    };
    const allowance = await ethereum.request({
        method: 'eth_call',
        params: [transactionParameters[0]],
    });
    tokenAllowances[0] = hex2dec(allowance);
    checkAllowanceTimeout(false);
}
const ff64 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
async function approveToken(tokenType=0) {
    const btnTokens = [document.getElementById('btnToken0')];
    const transactionParameters = {
        nonce: '0x00',
        //gasPrice: '0x3b9aca00',
        //gas: '0xc350',
        to: tokenContractAddresses[tokenType].toLowerCase(),
        from: accounts[0],
        value: '0x0',
        data: '0x095ea7b3'+zeroPadHex(stakingContractAddress)+ff64,
        chainId: useChainID,
    };
    btnTokens[tokenType].classList.add('disabled');
    btnTokens[tokenType].disabled = true;
    try {
        const txHash = await ethereum.request({
            method: 'eth_sendTransaction',
            params: [transactionParameters],
        });
    } catch(err) {
        btnTokens[tokenType].classList.remove('disabled');
        btnTokens[tokenType].disabled = false;
        console.log(err)
    }
    if (!(txHash)) {
        btnTokens[tokenType].classList.remove('disabled');
        btnTokens[tokenType].disabled = false;
    }
}
async function stakeUnstakeToken(tokenType=0) {
    const inputFields = document.querySelectorAll('input.inputField');
    let tokenAmount = dec2hex(inputFields[tokenType].value);
    if (BigInt(hex2dec(tokenAmount)) <= BigInt('0')) {return;}
    if (needsAllowance[tokenType] === 'true') {
        await approveToken();
    } else if (needsAllowance[tokenType] === 'false') {
        const transactionParameters = {
            nonce: '0x00',
            //gasPrice: '0x3b9aca00',
            //gas: '0x4c4b40',
            to: stakingContractAddress.toLowerCase(),
            from: accounts[0],
            value: '0x0',
            data: '0xa59f3e0c'+zeroPadHex(tokenAmount),
            chainId: useChainID,
        };
        const txHash = await ethereum.request({
            method: 'eth_sendTransaction',
            params: [transactionParameters],
        });
    }
}
