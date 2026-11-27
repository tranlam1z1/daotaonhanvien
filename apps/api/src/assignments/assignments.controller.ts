import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthOriginGuard, type SessionRequest } from '../auth/auth-http';
import { RequirePermission } from '../auth/authorization.guard';
import { idInput } from '../knowledge/knowledge-input';
import { AssignmentRulesService } from './assignment-rules.service';
import { assignmentContext, AssignmentsService } from './assignments.service';

const manageAssignments = () =>
  RequirePermission('assignments.manage', async (_db, { user }) =>
    assignmentContext(user!),
  );

@Controller('assignments')
export class AssignmentsController {
  constructor(
    @Inject(AssignmentsService)
    private readonly assignments: AssignmentsService,
    @Inject(AssignmentRulesService)
    private readonly rules: AssignmentRulesService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @manageAssignments()
  list(@Req() { user }: SessionRequest, @Query() query: unknown) {
    return this.assignments.list(user!, query);
  }

  @Get('options')
  @Header('Cache-Control', 'private, no-store')
  @manageAssignments()
  options(@Req() { user }: SessionRequest) {
    return this.assignments.options(user!);
  }

  @Post()
  @UseGuards(AuthOriginGuard)
  @manageAssignments()
  manual(@Req() { user, ip }: SessionRequest, @Body() body: unknown) {
    return this.assignments.manual(user!, body, ip);
  }

  @Patch(':id/deadline')
  @UseGuards(AuthOriginGuard)
  @manageAssignments()
  extend(
    @Req() { user, ip }: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.assignments.change(user!, idInput(id), 'extend', body, ip);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @UseGuards(AuthOriginGuard)
  @manageAssignments()
  cancel(@Req() { user }: SessionRequest, @Param('id') id: string) {
    return this.assignments.change(user!, idInput(id), 'cancel', null);
  }

  @Post(':id/reassign')
  @UseGuards(AuthOriginGuard)
  @manageAssignments()
  reassign(
    @Req() { user, ip }: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.assignments.change(user!, idInput(id), 'reassign', body, ip);
  }

  @Get('rules')
  @Header('Cache-Control', 'private, no-store')
  @manageAssignments()
  ruleList(@Req() { user }: SessionRequest) {
    return this.rules.list(user!);
  }

  @Post('rules')
  @UseGuards(AuthOriginGuard)
  @manageAssignments()
  createRule(@Req() { user, ip }: SessionRequest, @Body() body: unknown) {
    return this.rules.save(user!, body, undefined, ip);
  }

  @Patch('rules/:id')
  @UseGuards(AuthOriginGuard)
  @manageAssignments()
  updateRule(
    @Req() { user, ip }: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.rules.save(user!, body, idInput(id), ip);
  }
}
