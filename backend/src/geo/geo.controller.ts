import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GeoService } from './geo.service';

@ApiTags('Geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('countries')
  @ApiOperation({ summary: 'List all countries' })
  async getCountries() {
    return this.geoService.findCountries();
  }

  @Get('states')
  @ApiOperation({ summary: 'List states, optionally filtered by country' })
  async getStates(@Query('countryId') countryId?: string) {
    return this.geoService.findStates(countryId);
  }

  @Get('states/:id')
  @ApiOperation({ summary: 'Get state by ID with LGAs' })
  async getState(@Param('id') id: string) {
    return this.geoService.findStateById(id);
  }

  @Get('states/:id/lgas')
  @ApiOperation({ summary: 'List LGAs in a state' })
  async getLgasByState(@Param('id') stateId: string) {
    return this.geoService.findLgasByState(stateId);
  }

  @Get('lgas/:id')
  @ApiOperation({ summary: 'Get LGA by ID with wards' })
  async getLga(@Param('id') id: string) {
    return this.geoService.findLgaById(id);
  }

  @Get('lgas/:id/wards')
  @ApiOperation({ summary: 'List wards in an LGA' })
  async getWardsByLga(@Param('id') lgaId: string) {
    return this.geoService.findWardsByLga(lgaId);
  }

  @Get('wards/:id')
  @ApiOperation({ summary: 'Get ward by ID with communities' })
  async getWard(@Param('id') id: string) {
    return this.geoService.findWardById(id);
  }

  @Get('wards/:id/communities')
  @ApiOperation({ summary: 'List communities in a ward' })
  async getCommunitiesByWard(@Param('id') wardId: string) {
    return this.geoService.findCommunitiesByWard(wardId);
  }
}
