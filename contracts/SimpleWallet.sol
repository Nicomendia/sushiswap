// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.6.12;

import './uniswapv2/interfaces/IUniswapV2Pair.sol';
import './uniswapv2/interfaces/IUniswapV2Factory.sol';
import './uniswapv2/interfaces/IUniswapV2Router02.sol';

import './uniswapv2/interfaces/IERC20.sol';
import "./Ownable.sol";

interface IMasterChef {
  function deposit(uint256 _pid, uint256 _amount) external;
  function withdraw(uint256 _pid, uint256 _amount) external;
}

contract SimpleWallet is Ownable {
    address public immutable factory;
    address public immutable router;
    address public immutable chef;
    address public immutable sushi;

    constructor(address _router, address _chef, address _sushi) public {
        router = _router;
        chef = _chef;
        sushi = _sushi;
        factory = IUniswapV2Router02(_router).factory();
    }

    // Adds liquidity and deposits LP tokens in only one step 
    function addLiquidityWithFarming(
        address _tokenA,
        address _tokenB,
        uint _amountADesired,
        uint _amountBDesired,
        uint _amountAMin,
        uint _amountBMin,
        uint _deadline,
        uint _masterChefPoolId
    ) external onlyOwner {
        uint amountA;
        uint amountB;
        uint liquidity;

        address pair = IUniswapV2Factory(factory).getPair(_tokenA, _tokenB);

        IERC20Uniswap(_tokenA).approve(router, IERC20Uniswap(_tokenA).balanceOf(address(this)));
        IERC20Uniswap(_tokenB).approve(router, IERC20Uniswap(_tokenB).balanceOf(address(this)));
        
        (amountA, amountB, liquidity) = IUniswapV2Router02(router).addLiquidity(_tokenA, _tokenB, _amountADesired, _amountBDesired, _amountAMin, _amountBMin, address(this), _deadline);

        IERC20Uniswap(pair).approve(chef, liquidity);
        IMasterChef(chef).deposit(_masterChefPoolId, liquidity);
    }

    // withdraws original deposited tokens and all sushi rewards
    function withdrawLiquidityWithRewards(
        address _tokenA,
        address _tokenB,
        uint _liquidity,
        uint _amountAMin,
        uint _amountBMin,
        uint _deadline,
        uint _masterChefPoolId,
        uint _masterChefPoolAmount
    ) external onlyOwner {
        IERC20Uniswap(sushi).transfer(msg.sender, IERC20Uniswap(sushi).balanceOf(address(this)));
 
        IMasterChef(chef).withdraw(_masterChefPoolId, _masterChefPoolAmount);

        address pair = IUniswapV2Factory(factory).getPair(_tokenA, _tokenB);
        IERC20Uniswap(pair).approve(router, _liquidity);
        (uint amountA, uint amountB) = IUniswapV2Router02(router).removeLiquidity(_tokenA, _tokenB, _liquidity, _amountAMin, _amountBMin, msg.sender, _deadline);
        
    }

    // updates sushi rewards for farming pool
    function updateRewards(uint _poolId) external onlyOwner {
        IMasterChef(chef).deposit(_poolId, 0);
    }
}