package com.ninejatruth.app.data.remote.api

import com.ninejatruth.app.data.remote.dto.ApiResponse
import com.ninejatruth.app.data.remote.dto.CommunityDto
import com.ninejatruth.app.data.remote.dto.LgaDto
import com.ninejatruth.app.data.remote.dto.StateDto
import com.ninejatruth.app.data.remote.dto.WardDto
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path

interface GeoApi {

    @GET("geo/states")
    suspend fun getStates(): Response<ApiResponse<List<StateDto>>>

    @GET("geo/states/{stateId}/lgas")
    suspend fun getLgas(@Path("stateId") stateId: String): Response<ApiResponse<List<LgaDto>>>

    @GET("geo/lgas/{lgaId}/wards")
    suspend fun getWards(@Path("lgaId") lgaId: String): Response<ApiResponse<List<WardDto>>>

    @GET("geo/wards/{wardId}/communities")
    suspend fun getCommunities(@Path("wardId") wardId: String): Response<ApiResponse<List<CommunityDto>>>
}
