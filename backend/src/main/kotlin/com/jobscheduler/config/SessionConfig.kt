package com.jobscheduler.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.orm.jpa.JpaTransactionManager
import jakarta.persistence.EntityManagerFactory
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.session.jdbc.config.annotation.SpringSessionTransactionManager
import org.springframework.transaction.PlatformTransactionManager
import javax.sql.DataSource

/**
 * Spring Session JDBC는 JPA가 아닌 순수 JDBC 트랜잭션으로 세션을 읽고 쓴다(docs/deploy.md 4장).
 * JPA 트랜잭션을 쓰면 엔티티 매니저를 열 때 테넌트(로그인 사용자)를 묻고, 그게 다시 세션을 읽어 무한 반복이 된다.
 */
@Configuration
class SessionConfig {
    /** 앱의 기본 트랜잭션(JPA). 아래 세션 전용 매니저를 두면 스프링 부트가 자동으로 만들지 않아 직접 둔다 */
    @Bean
    @Primary
    fun transactionManager(entityManagerFactory: EntityManagerFactory): PlatformTransactionManager = JpaTransactionManager(entityManagerFactory)

    @Bean
    @SpringSessionTransactionManager
    fun springSessionTransactionManager(dataSource: DataSource): PlatformTransactionManager = DataSourceTransactionManager(dataSource)
}
