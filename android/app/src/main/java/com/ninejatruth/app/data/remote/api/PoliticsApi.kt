package com.ninejatruth.app.data.remote.api

import com.ninejatruth.app.data.remote.dto.ApiResponse
import com.ninejatruth.app.data.remote.dto.CandidateDto
import com.ninejatruth.app.data.remote.dto.ElectionDto
import com.ninejatruth.app.data.remote.dto.OfficeDto
import com.ninejatruth.app.data.remote.dto.PartyDto
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface PoliticsApi {

    @GET("parties")
    suspend fun getParties(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<PartyDto>>>

    @GET("parties/{id}")
    suspend fun getParty(@Path("id") partyId: String): Response<ApiResponse<PartyDto>>

    @GET("candidates")
    suspend fun getCandidates(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("partyId") partyId: String? = null,
        @Query("officeId") officeId: String? = null,
        @Query("stateId") stateId: String? = null
    ): Response<ApiResponse<List<CandidateDto>>>

    @GET("candidates/{id}")
    suspend fun getCandidate(@Path("id") candidateId: String): Response<ApiResponse<CandidateDto>>

    @GET("offices")
    suspend fun getOffices(): Response<ApiResponse<List<OfficeDto>>>

    @GET("offices/{id}")
    suspend fun getOffice(@Path("id") officeId: String): Response<ApiResponse<OfficeDto>>

    @GET("elections")
    suspend fun getElections(
        @Query("status") status: String? = null,
        @Query("stateId") stateId: String? = null
    ): Response<ApiResponse<List<ElectionDto>>>

    @GET("elections/{id}")
    suspend fun getElection(@Path("id") electionId: String): Response<ApiResponse<ElectionDto>>
}
