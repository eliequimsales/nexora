import { Module } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { PublicProposalController } from './public-proposal.controller';
import { ProposalsService } from './proposals.service';

@Module({
  controllers: [ProposalsController, PublicProposalController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
