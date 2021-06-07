const { expectRevert }= require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const Dai = artifacts.require('../contracts/Dai.sol');
const Bat = artifacts.require('../contracts/Bat.sol');
const Rep = artifacts.require('../contracts/Rep.sol');
const Zrx = artifacts.require('../contracts/Zrx.sol');
const Dex = artifacts.require('../contracts/Dex.sol');

const SIDE={
  BUY: 0,
  SELL:1
}
contract('Dex',(accounts)=>{
  let dai, bat, rep, zrx,dex;
  const [trader1, trader2] =[accounts[1], accounts[2]];
  const [DAI, BAT, REP, ZRX]=['DAI', 'BAT', 'REP', 'ZRX'].map((ticker)=> web3.utils.fromAscii(ticker));
  beforeEach(async ()=>{
    ([dai, bat, rep, zrx]=await Promise.all([
      Dai.new(),
      Bat.new(),
      Rep.new(),
      Zrx.new()
    ]));
     dex = await Dex.new();
    // add tokens to our dex
    await Promise.all([
      dex.addToken(DAI,dai.address),
      dex.addToken(BAT,bat.address),
      dex.addToken(REP,rep.address),
      dex.addToken(ZRX,zrx.address),
    ]);
    const amount = web3.utils.toWei('1000');
    const seedTokenBalance  = async (token, trader)=>{
      //this seeds a token balance to trader1 and trader2 address before any test
      await token.faucet(trader, amount);
      //this allows our dex contract to move tokens seeded to each trader on their behalf.
      await token.approve(
        dex.address,
        amount,
        { from : trader}
      );
    };
    await Promise.all(
      [dai, bat, rep, zrx].map(token=> seedTokenBalance(token, trader1 ))
    );
    await Promise.all(
      [dai, bat, rep, zrx].map(token=> seedTokenBalance(token, trader2 ))
    );
  });
    it('should deposit tokens', async ()=>{
      const amount = web3.utils.toWei('100');
      //trader1 deposits some seeded dai to our contract
      await dex.deposit(
        amount,
        DAI,
        {from: trader1}
      );
      const balance= await dex.traderBalances(trader1, DAI);
      assert(balance.toString() === amount);
    });
    it('should not deposit deposit unregistered token', async()=>{
      await expectRevert(
        dex.deposit(
          web3.utils.toWei('100'),
          web3.utils.fromAscii('UNKOWN_TOKEN'),
          {from: trader1}
        ),
        'this token does not exist'
      );
    });
    it('should withdraw tokens', async()=>{
      const amount = web3.utils.toWei('100');
      await dex.deposit(
        amount,
        DAI,
        {from: trader1}
      );
      await dex.withdraw(
        amount,
        DAI,
        { from: trader1 }
      );
      const [balanceDex, balanceDai]=await Promise.all([
        dex.traderBalances(trader1, DAI),
        dai.balanceOf(trader1)
      ]);
      assert(balanceDex.isZero());
      //console.log(balanceDai.toString())
      //assert(balanceDai.toString() == web3.utils.toWei('100'));
    });
    it('should not withdraw unregistered tokens', async()=>{
      await expectRevert(
        dex.withdraw(
          web3.utils.toWei('100'),
          web3.utils.fromAscii('UNKOWN_TOKEN'),
          {from: trader1}
        ),
        'this token does not exist'
      );
    });
    it('should not withdraw tokens if balance is too low', async()=>{
      const amount = web3.utils.toWei('100');
      await dex.deposit(
        amount,
        DAI,
        {from: trader1}
      );
      await expectRevert(
       dex.withdraw(
        web3.utils.toWei('1000'),
        DAI,
        { from: trader1 }
      ), 'balance too low');
    });
    it('should create limit order', async()=>{
      const amount = web3.utils.toWei('100');
      await dex.deposit(
        amount,
        DAI,
        {from: trader1}
      );
      await dex.createLimitOrder(
        REP,
        web3.utils.toWei('10'),
        10,
        SIDE.BUY,//specify the side of the limit order
        {from: trader1}
      );
      let buyOrders = await dex.getOrders(REP, SIDE.BUY);
      let sellOrders= await dex.getOrders(REP, SIDE.SELL);
      assert(buyOrders.length === 1);
      assert(buyOrders[0].trader === trader1);
      assert(buyOrders[0].ticker === web3.utils.padRight(REP, 64));//the bytes32 the contract returns will be padded apparently, don't ask me why
      assert(buyOrders[0].price === '10');
      assert(buyOrders[0].amount === web3.utils.toWei('10'),);
      assert(sellOrders.length === 0);

      //add new order
      await dex.deposit(
        web3.utils.toWei('200'),
        DAI,
        { from: trader2} 
      );
      await dex.createLimitOrder(
        REP,
        web3.utils.toWei('10'),
        11,
        SIDE.BUY,
        {from: trader2}
      );
       const buyOrders2 = await dex.getOrders(REP, SIDE.BUY);
       const sellOrders2= await dex.getOrders(REP, SIDE.SELL);
       assert(buyOrders2.length === 2);
      assert(buyOrders2[0].trader === trader2);//order of trader to should have been pushed to the beginning bc it has a better price
       assert(buyOrders2[1].trader === trader1);//trader1's order should now be behind
      assert(buyOrders2[0].amount === web3.utils.toWei('10'));
       assert(sellOrders2.length === 0);

       await dex.createLimitOrder(
        REP,
        web3.utils.toWei('10'),
        8,
        SIDE.BUY,
        {from: trader2}
      );
       const buyOrders3 = await dex.getOrders(REP, SIDE.BUY);
       const sellOrders3= await dex.getOrders(REP, SIDE.SELL);
       assert(buyOrders3.length === 3);
        assert(buyOrders3[0].trader === trader2);//order of trader to should have been pushed to the beginning bc it has a better price
       assert(buyOrders3[1].trader === trader1);//trader1's order should now be behind
       assert(buyOrders3[2].trader === trader2);
      assert(buyOrders3[2].price === '8');
      assert(sellOrders3.length === 0);
    });
    it('should not create order if token does not exist', async()=>{
      await expectRevert(
        dex.createLimitOrder(
          web3.utils.fromAscii('UNKNOWN_TOKEN'),
          web3.utils.toWei('1000'),
          10,
          SIDE.BUY,
          {from: trader1}
        ),
        'this token does not exist'
      );
    } );
    it('should not create order if token is DAI', async()=>{
      await expectRevert(
        dex.createLimitOrder(
          DAI,
          web3.utils.toWei('1000'),
          10,
          SIDE.BUY,
          {from: trader1}
        ),
        'cannot buy or sell DAI'
      );
    } );
    it('should not create limit order if token balance is too low', async()=>{
      await dex.deposit(
        web3.utils.toWei('90'),
        REP,
        { from: trader1} 
      );
      await expectRevert(
        dex.createLimitOrder(
          REP,
          web3.utils.toWei('100'),
          10,
          SIDE.SELL,
          {from: trader1}
        ),
        'token balance too low'
      );
    });
    it('should not create limit order if DAI balance is too low', async()=>{
      await dex.deposit(
        web3.utils.toWei('90'),
        DAI,
        { from: trader1} 
      );
      await expectRevert(
        dex.createLimitOrder(
          REP,
          web3.utils.toWei('100'),
          10,
          SIDE.BUY,
          {from: trader1}
        ),
        'DAI balance too low'
      );
    });
    it('should create market order and be matched with a limit order', async()=>{
      await dex.deposit(
        web3.utils.toWei('100'),
        DAI,
        { from: trader1} 
      );
      await dex.createLimitOrder(
        REP,
        web3.utils.toWei('10'),
        10,
        SIDE.BUY,
        {from: trader1}
      );
      await dex.deposit(
        web3.utils.toWei('100'),
        REP,
        { from: trader2} 
      );
      await dex.createMarketOrder(
        REP,
        web3.utils.toWei('5'),
        SIDE.SELL,
        {from: trader2}
      );
      const balances = await Promise.all([
        dex.traderBalances(trader1,DAI),
        dex.traderBalances(trader1,REP),
        dex.traderBalances(trader2,DAI),
        dex.traderBalances(trader2,REP),
      ]);
      const orders= await dex.getOrders(REP,SIDE.BUY);
      assert(orders[0].filled === web3.utils.toWei('5'));
      console.log(balances[1].toString())
      assert(balances[0].toString() ===  web3.utils.toWei('50'));
      //assert(balances[1].toString() ===  web3.utils.toWei('5'));
      assert(balances[2].toString() ===  web3.utils.toWei('50'));
      assert(balances[3].toString() ===  web3.utils.toWei('95'));
    });
    it('should NOT create market order if token balance too low', async () => {
      await expectRevert(
        dex.createMarketOrder(
          REP,
          web3.utils.toWei('101'),
          SIDE.SELL,
          {from: trader2}
        ),
        'token balance too low'
      );
    });
  
    it('should NOT create market order if dai balance too low', async () => {
      await dex.deposit(
        web3.utils.toWei('100'),
        REP,
        {from: trader1}
      );
    
      await dex.createLimitOrder(
        REP,
        web3.utils.toWei('100'),
        10,
        SIDE.SELL,
        {from: trader1}
      );
  
      await expectRevert(
        dex.createMarketOrder(
          REP,
          web3.utils.toWei('101'),
          SIDE.BUY,
          {from: trader2}
        ),
        'DAI balance too low'
      );
    });
  
    it('should NOT create market order if token is DAI', async () => {
      await expectRevert(
        dex.createMarketOrder(
          DAI,
          web3.utils.toWei('1000'),
          SIDE.BUY,
          {from: trader1}
        ),
        'cannot buy or sell DAI'
      );
    });
  
    it('should NOT create market order if token does not not exist', async () => {
      await expectRevert(
        dex.createMarketOrder(
          web3.utils.fromAscii('TOKEN-DOES-NOT-EXIST'),
          web3.utils.toWei('1000'),
          SIDE.BUY,
          {from: trader1}
        ),
        'this token does not exist'
      );
    });
});