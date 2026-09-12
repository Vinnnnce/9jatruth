package com.ninejatruth.app.data.repository

import com.ninejatruth.app.data.remote.api.GeoApi
import com.ninejatruth.app.domain.model.Community
import com.ninejatruth.app.domain.model.Lga
import com.ninejatruth.app.domain.model.State
import com.ninejatruth.app.domain.model.Ward
import com.ninejatruth.app.domain.repository.GeoRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GeoRepositoryImpl @Inject constructor(
    private val geoApi: GeoApi
) : GeoRepository {

    override fun getStates(): Flow<Result<List<State>>> = flow {
        emit(Result.Loading)
        try {
            val response = geoApi.getStates()
            if (response.isSuccessful) {
                val states = response.body()?.data?.map { it.toDomain() } ?: emptyList()
                emit(Result.Success(states))
            } else {
                emit(Result.Error(response.message() ?: "Failed to load states"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    override fun getLgas(stateId: String): Flow<Result<List<Lga>>> = flow {
        emit(Result.Loading)
        try {
            val response = geoApi.getLgas(stateId)
            if (response.isSuccessful) {
                val lgas = response.body()?.data?.map { it.toDomain() } ?: emptyList()
                emit(Result.Success(lgas))
            } else {
                emit(Result.Error(response.message() ?: "Failed to load LGAs"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    override fun getWards(lgaId: String): Flow<Result<List<Ward>>> = flow {
        emit(Result.Loading)
        try {
            val response = geoApi.getWards(lgaId)
            if (response.isSuccessful) {
                val wards = response.body()?.data?.map { it.toDomain() } ?: emptyList()
                emit(Result.Success(wards))
            } else {
                emit(Result.Error(response.message() ?: "Failed to load wards"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    override fun getCommunities(wardId: String): Flow<Result<List<Community>>> = flow {
        emit(Result.Loading)
        try {
            val response = geoApi.getCommunities(wardId)
            if (response.isSuccessful) {
                val communities = response.body()?.data?.map { it.toDomain() } ?: emptyList()
                emit(Result.Success(communities))
            } else {
                emit(Result.Error(response.message() ?: "Failed to load communities"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    private fun com.ninejatruth.app.data.remote.dto.StateDto.toDomain() = State(
        id = id,
        name = name,
        code = code,
        region = region,
        capital = capital,
        population = population
    )

    private fun com.ninejatruth.app.data.remote.dto.LgaDto.toDomain() = Lga(
        id = id,
        name = name,
        stateId = stateId,
        headquarters = headquarters
    )

    private fun com.ninejatruth.app.data.remote.dto.WardDto.toDomain() = Ward(
        id = id,
        name = name,
        lgaId = lgaId
    )

    private fun com.ninejatruth.app.data.remote.dto.CommunityDto.toDomain() = Community(
        id = id,
        name = name,
        wardId = wardId,
        population = population
    )
}
