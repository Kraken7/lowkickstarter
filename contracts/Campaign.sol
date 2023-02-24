// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './LowkickStarter.sol';

contract Campaign {
    uint public goal;
    uint public endsAt;
    uint public pledged;
    uint public id;
    bool public claimed;
    address public organizer;
    LowkickStarter private parent;

    mapping (address => uint) pledges;

    event Pledged(uint value, address pledger);
    event RefundedPledge(uint value, address pledger);
    event FullRefund(uint value, address pledger);
    event Claimed(uint indexed id, uint value);

    constructor(uint _endsAt, uint _goal, address _organizer, uint _id) {
        endsAt = _endsAt;
        goal = _goal;
        id = _id;
        organizer = _organizer;
        parent = LowkickStarter(msg.sender);
    }

    function pledge() external payable {
        require(block.timestamp <= endsAt, 'time is over');
        require(msg.value > 0, 'not enough funds');

        pledged += msg.value;
        pledges[msg.sender] += msg.value;

        emit Pledged(msg.value, msg.sender);
    }

    function refundPledge(uint _amount) external {
        require(block.timestamp <= endsAt, 'time is over');
        require(pledges[msg.sender] >= _amount, 'not enough funds');

        pledged -= _amount;
        pledges[msg.sender] -= _amount;

        payable(msg.sender).transfer(_amount);

        emit RefundedPledge(_amount, msg.sender);
    }

    function fullRefund() external {
        require(block.timestamp > endsAt, 'time is not over');
        require(pledged < goal, 'goal achieved');

        uint refundAmount = pledges[msg.sender];
        pledges[msg.sender] = 0;
        payable(msg.sender).transfer(refundAmount);

        emit FullRefund(refundAmount, msg.sender);
    }

    function claim() external {
        require(msg.sender == organizer, 'access is denied');
        require(block.timestamp > endsAt, 'time is not over');
        require(pledged >= goal, 'goal not achieved');
        require(!claimed, 'already claimed');

        claimed = true;

        payable(organizer).transfer(pledged);

        parent.onClaimed(id);

        emit Claimed(id, pledged);
    }
}