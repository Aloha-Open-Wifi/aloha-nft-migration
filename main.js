require('dotenv').config();

class AlohaMigrator {
    constructor() {
        this.newContractAbi = require('./abis/v2.json');
        this.oldContractAbi = require('./abis/v1.json');
        this.v2Address = '0xFbb85FafE01BFce4974eE04cFeD386DD82A20C76';
        this.v1Address = '0x94d6a6032400e99639dd72612045402247d72436';
        this.Web3 = require('web3');
    }

    async run() {
        const ids = await this._getNonMigratedIds();
        const web3 = this._getWeb3();
        const gasPrice = await web3.eth.getGasPrice();
        for (const id of ids) {
            console.log('Migrating token number ' + id);
            const gasEstimate = await this._getNewContract().methods.migrateToken(id).estimateGas({ from: this.address });
            await this._getNewContract().methods.migrateToken(id).send({
                from: this.address,
                gasPrice: gasPrice, 
                gas: gasEstimate
            });
            console.log('Migrated!');
        }
    }

    async _getNonMigratedIds() {
        const ids = await this._getLastMinteds();
        const contract = this._getNewContract();
        const nonMinteds = [];
        for (const id of ids) {
            try {
                await contract.methods.migrateToken(id).call(); // If the contract doesn't throw an exception, is pending
                nonMinteds.push(id);
            } catch (e) {
                //
            }
        }
        return nonMinteds;
    }

    async _getLastMinteds() {
        let lastBlock = 0;
        const events = await this._getOldContract().getPastEvents('Transfer', {
            filter: {from: '0x0000000000000000000000000000000000000000'},
            fromBlock: lastBlock,
            toBlock: 'latest'
        });

        let ids = [];

        for (const event of events) {
            ids.push(event.returnValues.tokenId);
        }
        return ids;
    }

    _getNewContract() {
        const web3 = this._getWeb3();
        return new web3.eth.Contract(this.newContractAbi, this.v2Address);
    }

    _getOldContract() {
        const web3 = this._getWeb3();
        return new web3.eth.Contract(this.oldContractAbi, this.v1Address);
    }

    _getWeb3() {
        let prefix = 'mainnet';
        if (process.env.TESTNET == '1') {
            prefix = 'goerli';
        }
        const web3 = new this.Web3(
            'wss://' + prefix + '.infura.io/ws/v3/' + process.env.INFURA_ID,
        );

        this.address = web3.eth.accounts.wallet.add(process.env.PRIVATE_KEY).address;

        return web3;
    }
}

async function migrate() {
    await new AlohaMigrator().run();
    setTimeout(() => {
        migrate();
    }, 5000);
}

migrate();
