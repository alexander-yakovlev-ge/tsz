import { Module } from '@nestjs/common';
import { ImportController } from './import/import.controller';
import { ImportService } from './import/import.service';
import { MeUnitsController } from './me-units.controller';
import { OwnerIdsService } from './owner-ids.service';
import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';
import { UnitAccessService } from './unit-access.service';
import { UnitDocumentsService } from './unit-documents.service';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

/** Реестр: помещения, собственники, документы помещений, импорт из выписки (этап 4). */
@Module({
  controllers: [UnitsController, OwnersController, ImportController, MeUnitsController],
  providers: [
    OwnerIdsService,
    UnitAccessService,
    UnitsService,
    UnitDocumentsService,
    OwnersService,
    ImportService,
  ],
  exports: [UnitAccessService],
})
export class RegistryModule {}
