package com.ninejatruth.app.di

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.ninejatruth.app.data.remote.api.AuthApi
import com.ninejatruth.app.data.remote.api.FeedApi
import com.ninejatruth.app.data.remote.api.GeoApi
import com.ninejatruth.app.data.remote.api.NewsApi
import com.ninejatruth.app.data.remote.api.PollsApi
import com.ninejatruth.app.data.remote.api.PoliticsApi
import com.ninejatruth.app.data.remote.api.UserApi
import com.ninejatruth.app.data.remote.interceptor.AuthInterceptor
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private const val BASE_URL = "https://api.9jatruth.com/v1/"

    @Provides
    @Singleton
    fun provideGson(): Gson = GsonBuilder()
        .setDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
        .create()

    @Provides
    @Singleton
    fun provideLoggingInterceptor(): HttpLoggingInterceptor =
        HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        loggingInterceptor: HttpLoggingInterceptor
    ): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(
        okHttpClient: OkHttpClient,
        gson: Gson
    ): Retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .build()

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi =
        retrofit.create(AuthApi::class.java)

    @Provides
    @Singleton
    fun provideFeedApi(retrofit: Retrofit): FeedApi =
        retrofit.create(FeedApi::class.java)

    @Provides
    @Singleton
    fun providePoliticsApi(retrofit: Retrofit): PoliticsApi =
        retrofit.create(PoliticsApi::class.java)

    @Provides
    @Singleton
    fun provideNewsApi(retrofit: Retrofit): NewsApi =
        retrofit.create(NewsApi::class.java)

    @Provides
    @Singleton
    fun providePollsApi(retrofit: Retrofit): PollsApi =
        retrofit.create(PollsApi::class.java)

    @Provides
    @Singleton
    fun provideGeoApi(retrofit: Retrofit): GeoApi =
        retrofit.create(GeoApi::class.java)

    @Provides
    @Singleton
    fun provideUserApi(retrofit: Retrofit): UserApi =
        retrofit.create(UserApi::class.java)
}
